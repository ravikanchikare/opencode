import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { globalConfigDirectory, seedBundledPlugins, seedPluginsFrom } from "./seed-plugins"

const scratch = () => mkdtempSync(join(tmpdir(), "seed-plugins-"))

function source(files: Record<string, string>): string {
  const directory = scratch()
  for (const [name, contents] of Object.entries(files)) writeFileSync(join(directory, name), contents)
  return directory
}

describe("globalConfigDirectory", () => {
  test("prefers the explicit override the server also honours", () => {
    expect(globalConfigDirectory({ OPENCODE_CONFIG_DIR: "/explicit" } as NodeJS.ProcessEnv, "/home/x")).toBe(
      "/explicit",
    )
  })

  test("falls back to XDG, then the home default", () => {
    expect(globalConfigDirectory({ XDG_CONFIG_HOME: "/xdg" } as NodeJS.ProcessEnv, "/home/x")).toBe("/xdg/opencode")
    expect(globalConfigDirectory({} as NodeJS.ProcessEnv, "/home/x")).toBe("/home/x/.config/opencode")
  })

  test("uses the application identity below XDG without overriding an explicit config directory", () => {
    expect(
      globalConfigDirectory({ OPENCODE_APP_ID: "factory", XDG_CONFIG_HOME: "/xdg" } as NodeJS.ProcessEnv, "/home/x"),
    ).toBe("/xdg/factory")
    expect(
      globalConfigDirectory(
        { OPENCODE_APP_ID: "factory", OPENCODE_CONFIG_DIR: "/explicit" } as NodeJS.ProcessEnv,
        "/home/x",
      ),
    ).toBe("/explicit")
  })
})

describe("seedPluginsFrom", () => {
  test("installs bundles into <config>/plugin", () => {
    const from = source({ "a.js": "export default { id: 'a' }", "b.js": "export default { id: 'b' }" })
    const config = scratch()

    const result = seedPluginsFrom(from, config)

    expect(result.installed.sort()).toEqual(["a.js", "b.js"])
    expect(readdirSync(join(config, "plugin")).sort()).toEqual(["a.js", "b.js"])
  })

  test("is idempotent, so running it on every launch touches nothing", () => {
    const from = source({ "a.js": "export default { id: 'a' }" })
    const config = scratch()

    seedPluginsFrom(from, config)
    const second = seedPluginsFrom(from, config)

    expect(second.installed).toEqual([])
    expect(second.unchanged).toEqual(["a.js"])
  })

  test("overwrites a stale bundle, which is how an app upgrade ships a new plugin", () => {
    const from = source({ "a.js": "old" })
    const config = scratch()
    seedPluginsFrom(from, config)

    writeFileSync(join(from, "a.js"), "new")
    const second = seedPluginsFrom(from, config)

    expect(second.installed).toEqual(["a.js"])
    expect(readFileSync(join(config, "plugin", "a.js"), "utf8")).toBe("new")
  })

  test("ignores non-bundle files", () => {
    const from = source({ "a.js": "x", "README.md": "docs", "b.txt": "no" })
    const config = scratch()

    expect(seedPluginsFrom(from, config).installed).toEqual(["a.js"])
  })

  test("does nothing when there is nothing to install", () => {
    const config = scratch()
    const result = seedPluginsFrom(scratch(), config)

    expect(result).toEqual({ installed: [], unchanged: [] })
    // No empty plugin directory is created for an empty source.
    expect(readdirSync(config)).toEqual([])
  })

  test("leaves a user's own plugins alone", () => {
    const from = source({ "seeded.js": "x" })
    const config = scratch()
    mkdirSync(join(config, "plugin"), { recursive: true })
    writeFileSync(join(config, "plugin", "mine.js"), "user")

    seedPluginsFrom(from, config)

    expect(readdirSync(join(config, "plugin")).sort()).toEqual(["mine.js", "seeded.js"])
    expect(readFileSync(join(config, "plugin", "mine.js"), "utf8")).toBe("user")
  })

  test("one bad bundle does not stop the rest, and leaves no staging file", () => {
    const from = source({ "a.js": "x", "b.js": "y" })
    const config = scratch()
    // Make one target unwritable by creating a directory where the file goes.
    mkdirSync(join(config, "plugin", "a.js"), { recursive: true })

    const result = seedPluginsFrom(from, config)

    expect(result.installed).toEqual(["b.js"])
    expect(readdirSync(join(config, "plugin")).filter((f) => f.endsWith(".installing"))).toEqual([])
  })
})

describe("seedBundledPlugins", () => {
  const logger = { log: () => {}, error: () => {} }

  test("does nothing when unpackaged and no source is given", () => {
    const config = scratch()
    const result = seedBundledPlugins({
      packaged: false,
      resourcesPath: scratch(),
      logger,
      configDirectory: config,
    })
    expect(result.installed).toEqual([])
  })

  test("an explicit source is honoured even when unpackaged, so dev can exercise it", () => {
    const from = source({ "a.js": "x" })
    const config = scratch()

    const result = seedBundledPlugins({
      packaged: false,
      resourcesPath: scratch(),
      source: from,
      logger,
      configDirectory: config,
    })

    expect(result.installed).toEqual(["a.js"])
    expect(readdirSync(join(config, "plugin"))).toEqual(["a.js"])
  })

  test("a source that does not exist falls back rather than throwing", () => {
    const config = scratch()
    const result = seedBundledPlugins({
      packaged: false,
      resourcesPath: scratch(),
      source: join(scratch(), "missing"),
      logger,
      configDirectory: config,
    })
    expect(result.installed).toEqual([])
  })
})
