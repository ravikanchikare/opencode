import { afterEach, describe, expect, test } from "bun:test"
import { generateKeyPairSync, sign } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Effect } from "effect"
import { makeUnsignedDarwinPlatform } from "./unsigned-darwin"
import { isNewerVersion, parseLatestYml, selectMacZip } from "./latest-yml"

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

function keyPair() {
  const pair = generateKeyPairSync("ed25519")
  const der = pair.publicKey.export({ type: "spki", format: "der" })
  return {
    publicKey: Buffer.from(der.subarray(der.length - 32)).toString("base64"),
    sign(payload: Uint8Array) {
      return sign(null, payload, pair.privateKey).toString("base64")
    },
  }
}

const feedText = `
version: 2.0.0
files:
  - url: workbench-2.0.0-mac-arm64.zip
    sha512: PLACEHOLDER
    size: SIZE
  - url: workbench-2.0.0-mac-arm64.dmg
    sha512: ignored
    size: 1
path: workbench-2.0.0-mac-arm64.zip
releaseDate: '2026-04-08T00:00:00.000Z'
`.trimStart()

async function setupFeed() {
  const root = await mkdtemp(path.join(tmpdir(), "unsigned-updater-"))
  dirs.push(root)
  const zip = Buffer.from("opencode-update-zip")
  const sha512 = Bun.CryptoHasher.hash("sha512", zip, "base64")
  const yml = feedText.replace("PLACEHOLDER", sha512).replace("SIZE", String(zip.byteLength))
  const keys = keyPair()
  const files = new Map<string, Uint8Array>([
    ["latest-mac.yml", new TextEncoder().encode(yml)],
    ["latest-mac.yml.sig", new TextEncoder().encode(keys.sign(new TextEncoder().encode(yml)))],
    ["workbench-2.0.0-mac-arm64.zip", zip],
  ])
  const helper = path.join(root, "helper")
  await writeFile(helper, "#!/bin/sh\n")
  const cacheDir = path.join(root, "cache")
  await mkdir(cacheDir)
  const spawned: string[][] = []
  const platform = makeUnsignedDarwinPlatform({
    feedUrl: "https://updates.example/",
    publicKey: keys.publicKey,
    currentVersion: "1.0.0",
    cacheDir,
    helperPath: helper,
    appPath: path.join(root, "Applied AI Workbench.app"),
    pid: 4242,
    arch: "arm64",
    fetch: async (input) => {
      const url = String(input)
      const name = url.split("/").pop() ?? ""
      const body = files.get(name)
      if (!body) return new Response(null, { status: 404 })
      return new Response(body)
    },
    spawnHelper: (_command, args) => {
      spawned.push(args)
    },
    quit: () => {},
    setQuitting: () => {},
    canWrite: async () => true,
  })
  return { platform, spawned, cacheDir, keys, files, yml, zip }
}

describe("unsigned darwin updater", () => {
  test("parses electron-builder latest-mac.yml and prefers the arch zip", () => {
    const parsed = parseLatestYml(feedText.replace("PLACEHOLDER", "abc").replace("SIZE", "12"))
    expect(parsed.version).toBe("2.0.0")
    expect(selectMacZip(parsed.files, "arm64").url).toBe("workbench-2.0.0-mac-arm64.zip")
    expect(isNewerVersion("2.0.0", "1.0.0")).toBe(true)
    expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false)
  })

  test("checks, stages, and launches the helper with the hashed zip", async () => {
    const app = await setupFeed()
    expect(await Effect.runPromise(app.platform.checkForUpdate)).toBe("2.0.0")
    await Effect.runPromise(app.platform.stageUpdate)
    const zipPath = path.join(app.cacheDir, "2.0.0-workbench-2.0.0-mac-arm64.zip")
    expect(await readFile(zipPath)).toEqual(app.zip)
    const install = Effect.runPromise(app.platform.installAndRestart)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(app.spawned).toEqual([
      ["4242", path.join(dirs[0], "Applied AI Workbench.app"), zipPath, Bun.CryptoHasher.hash("sha512", app.zip, "base64")],
    ])
    install.catch(() => undefined)
  })

  test("rejects a feed whose signature does not match", async () => {
    const app = await setupFeed()
    app.files.set("latest-mac.yml.sig", new TextEncoder().encode(app.keys.sign(new TextEncoder().encode("tampered"))))
    await expect(Effect.runPromise(app.platform.checkForUpdate)).rejects.toThrow(/signature is invalid/)
  })

  test("rejects a zip whose checksum does not match", async () => {
    const app = await setupFeed()
    app.files.set("workbench-2.0.0-mac-arm64.zip", new TextEncoder().encode("nope"))
    await expect(Effect.runPromise(app.platform.stageUpdate)).rejects.toThrow(/checksum mismatch|size mismatch/)
  })

  test("fails closed when the application directory is not writable", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "unsigned-updater-"))
    dirs.push(root)
    const zip = Buffer.from("opencode-update-zip")
    const sha512 = Bun.CryptoHasher.hash("sha512", zip, "base64")
    const yml = feedText.replace("PLACEHOLDER", sha512).replace("SIZE", String(zip.byteLength))
    const keys = keyPair()
    const helper = path.join(root, "helper")
    await writeFile(helper, "#!/bin/sh\n")
    const platform = makeUnsignedDarwinPlatform({
      feedUrl: "https://updates.example/",
      publicKey: keys.publicKey,
      currentVersion: "1.0.0",
      cacheDir: path.join(root, "cache"),
      helperPath: helper,
      appPath: path.join(root, "Applied AI Workbench.app"),
      pid: 1,
      arch: "arm64",
      fetch: async (input) => {
        const name = String(input).split("/").pop() ?? ""
        if (name === "latest-mac.yml") return new Response(new TextEncoder().encode(yml))
        if (name === "latest-mac.yml.sig") return new Response(new TextEncoder().encode(keys.sign(new TextEncoder().encode(yml))))
        if (name.endsWith(".zip")) return new Response(zip)
        return new Response(null, { status: 404 })
      },
      spawnHelper: () => {
        throw new Error("helper must not run")
      },
      quit: () => {
        throw new Error("app must not quit")
      },
      setQuitting: () => {},
      canWrite: async () => false,
    })
    await Effect.runPromise(platform.stageUpdate)
    await expect(Effect.runPromise(platform.installAndRestart)).rejects.toThrow(/not writable/)
  })
})
