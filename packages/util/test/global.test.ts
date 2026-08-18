import { describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { pathToFileURL } from "url"
import { Context, Effect, Layer } from "effect"
import { Global } from "../src/global.js"

describe("global", () => {
  test("uses the application identity for every XDG root", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-global-brand-"))
    const module = pathToFileURL(path.join(import.meta.dir, "../src/global.ts")).href
    const result = Bun.spawnSync({
      cmd: [
        process.execPath,
        "-e",
        `const { Global } = await import(${JSON.stringify(module)}); process.stdout.write(JSON.stringify(Global.Path))`,
      ],
      env: {
        ...process.env,
        OPENCODE_APP_ID: "factory",
        XDG_DATA_HOME: path.join(root, "data"),
        XDG_CACHE_HOME: path.join(root, "cache"),
        XDG_CONFIG_HOME: path.join(root, "config"),
        XDG_STATE_HOME: path.join(root, "state"),
        TMPDIR: path.join(root, "tmp"),
      },
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(result.exitCode, result.stderr.toString()).toBe(0)
    const paths = JSON.parse(result.stdout.toString()) as Record<string, string>
    expect(paths.data).toBe(path.join(root, "data", "factory"))
    expect(paths.cache).toBe(path.join(root, "cache", "factory"))
    expect(paths.config).toBe(path.join(root, "config", "factory"))
    expect(paths.state).toBe(path.join(root, "state", "factory"))
    expect(paths.tmp).toBe(path.join(root, "tmp", "factory"))
    fs.rmSync(root, { recursive: true, force: true })
  })

  test("branding alone does not move the XDG roots", () => {
    // A branded desktop app and stock OpenCode are meant to share one config
    // directory, one set of credentials, and one project list. Only an explicit
    // OPENCODE_APP_ID separates them; a product name never does.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-global-shared-"))
    const module = pathToFileURL(path.join(import.meta.dir, "../src/global.ts")).href
    const result = Bun.spawnSync({
      cmd: [
        process.execPath,
        "-e",
        `const { Global } = await import(${JSON.stringify(module)}); process.stdout.write(JSON.stringify(Global.Path))`,
      ],
      env: {
        ...process.env,
        OPENCODE_APP_ID: undefined,
        OPENCODE_DESKTOP_NAME: "Factory",
        OPENCODE_DESKTOP_APP_ID: "ai.factory.desktop",
        XDG_DATA_HOME: path.join(root, "data"),
        XDG_CONFIG_HOME: path.join(root, "config"),
        XDG_STATE_HOME: path.join(root, "state"),
        XDG_CACHE_HOME: path.join(root, "cache"),
        TMPDIR: path.join(root, "tmp"),
      },
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(result.exitCode, result.stderr.toString()).toBe(0)
    const paths = JSON.parse(result.stdout.toString()) as Record<string, string>
    expect(paths.config).toBe(path.join(root, "config", "opencode"))
    expect(paths.data).toBe(path.join(root, "data", "opencode"))
    expect(paths.state).toBe(path.join(root, "state", "opencode"))
    fs.rmSync(root, { recursive: true, force: true })
  })

  test("importing the module does not create directories", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-global-import-"))
    const directories = ["data", "cache", "config", "state", "tmp"].map((directory) => path.join(root, directory))
    const module = pathToFileURL(path.join(import.meta.dir, "../src/global.ts")).href
    const result = Bun.spawnSync({
      cmd: [process.execPath, "-e", `const { Global } = await import(${JSON.stringify(module)}); void Global.Path.tmp`],
      env: {
        ...process.env,
        XDG_DATA_HOME: directories[0],
        XDG_CACHE_HOME: directories[1],
        XDG_CONFIG_HOME: directories[2],
        XDG_STATE_HOME: directories[3],
        TMPDIR: directories[4],
      },
      stderr: "pipe",
    })

    expect(result.exitCode, result.stderr.toString()).toBe(0)
    directories.forEach((directory) => expect(fs.existsSync(path.join(directory, "opencode"))).toBe(false))
    fs.rmSync(root, { recursive: true, force: true })
  })

  test("building layerWith creates service directories and preserves an explicit tmp", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-global-layer-"))
    const directories = {
      data: path.join(root, "data"),
      config: path.join(root, "config"),
      state: path.join(root, "state"),
      log: path.join(root, "log"),
      bin: path.join(root, "bin"),
      repos: path.join(root, "repos"),
      tmp: path.join(root, "nested", "..", "tmp"),
    }

    const context = await Effect.runPromise(Effect.scoped(Layer.build(Global.layerWith(directories))))

    Object.values(directories).forEach((directory) => expect(fs.statSync(directory).isDirectory()).toBe(true))
    expect(Context.get(context, Global.Service).tmp).toBe(directories.tmp)
    fs.rmSync(root, { recursive: true, force: true })
  })

  test("building a layer with default tmp creates and canonicalizes it", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-global-layer-"))
    const directories = ["data", "cache", "config", "state", "tmp"].map((directory) => path.join(root, directory))
    const module = pathToFileURL(path.join(import.meta.dir, "../src/global.ts")).href
    const result = Bun.spawnSync({
      cmd: [
        process.execPath,
        "-e",
        `
          import { Context, Effect, Layer } from "effect"
          const { Global } = await import(${JSON.stringify(module)})
          const context = await Effect.runPromise(Effect.scoped(Layer.build(Global.layerWith({}))))
          process.stdout.write(Context.get(context, Global.Service).tmp)
        `,
      ],
      cwd: path.join(import.meta.dir, ".."),
      env: {
        ...process.env,
        XDG_DATA_HOME: directories[0],
        XDG_CACHE_HOME: directories[1],
        XDG_CONFIG_HOME: directories[2],
        XDG_STATE_HOME: directories[3],
        TMPDIR: directories[4],
      },
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(result.exitCode, result.stderr.toString()).toBe(0)
    expect(result.stdout.toString()).toBe(fs.realpathSync(path.join(directories[4], "opencode")))
    const created = [
      path.join(directories[0], "opencode"),
      path.join(directories[1], "opencode", "bin"),
      path.join(directories[2], "opencode"),
      path.join(directories[3], "opencode"),
      path.join(directories[0], "opencode", "log"),
      path.join(directories[0], "opencode", "repos"),
      path.join(directories[4], "opencode"),
    ]
    created.forEach((directory) => expect(fs.statSync(directory).isDirectory()).toBe(true))
    fs.rmSync(root, { recursive: true, force: true })
  })
})
