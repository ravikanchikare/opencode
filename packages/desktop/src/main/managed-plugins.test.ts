import { createHash } from "node:crypto"
import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { configureManagedPlugins, managedPluginPaths } from "./managed-plugins"

const scratch = () => mkdtempSync(join(tmpdir(), "managed-plugins-"))

function source(plugins: { readonly id: string; readonly file: string; readonly contents: string }[]) {
  const directory = scratch()
  mkdirSync(directory, { recursive: true })
  plugins.forEach((plugin) => writeFileSync(join(directory, plugin.file), plugin.contents))
  writeFileSync(
    join(directory, "manifest.json"),
    JSON.stringify({
      version: 1,
      plugins: plugins.map((plugin) => ({
        id: plugin.id,
        file: plugin.file,
        version: "1.0.0",
        sha256: createHash("sha256").update(plugin.contents).digest("hex"),
      })),
    }),
  )
  return directory
}

describe("managedPluginPaths", () => {
  test("does nothing when an unpackaged stock app has no explicit source", () => {
    expect(managedPluginPaths({ packaged: false, resourcesPath: scratch() })).toEqual([])
  })

  test("loads verified plugin files from an explicit development source", () => {
    const directory = source([
      { id: "acme.a", file: "acme.a.js", contents: "export default { id: 'acme.a' }" },
      { id: "acme.b", file: "acme.b.js", contents: "export default { id: 'acme.b' }" },
    ])

    expect(managedPluginPaths({ packaged: false, resourcesPath: scratch(), source: directory })).toEqual([
      join(directory, "acme.a.js"),
      join(directory, "acme.b.js"),
    ])
  })

  test("rejects a bundle that does not match its manifest checksum", () => {
    const directory = source([{ id: "acme.a", file: "acme.a.js", contents: "original" }])
    writeFileSync(join(directory, "acme.a.js"), "changed")

    expect(() => managedPluginPaths({ packaged: false, resourcesPath: scratch(), source: directory })).toThrow(
      "checksum mismatch",
    )
  })

  test("rejects duplicate IDs and unsafe file names", () => {
    const duplicate = source([
      { id: "acme.a", file: "a.js", contents: "a" },
      { id: "acme.a", file: "b.js", contents: "b" },
    ])
    expect(() => managedPluginPaths({ packaged: false, resourcesPath: scratch(), source: duplicate })).toThrow(
      "Duplicate managed plugin ID",
    )

    const directory = scratch()
    writeFileSync(
      join(directory, "manifest.json"),
      JSON.stringify({
        version: 1,
        plugins: [{ id: "acme.a", file: "../a.js", version: "1", sha256: "0".repeat(64) }],
      }),
    )
    expect(() => managedPluginPaths({ packaged: false, resourcesPath: scratch(), source: directory })).toThrow(
      "Invalid managed plugin file name",
    )
  })
})

describe("configureManagedPlugins", () => {
  test("publishes only verified app-resource paths to the server environment", () => {
    const directory = source([{ id: "acme.a", file: "acme.a.js", contents: "a" }])
    const env: Record<string, string | undefined> = {}

    const plugins = configureManagedPlugins({ packaged: false, resourcesPath: scratch(), source: directory }, env)

    expect(JSON.parse(env.OPENCODE_MANAGED_PLUGINS ?? "[]")).toEqual(plugins)
  })

  test("replaces an ambient managed source when the app has no managed resources", () => {
    const env = { OPENCODE_MANAGED_PLUGINS: '["/tmp/unverified.js"]' }

    expect(configureManagedPlugins({ packaged: false, resourcesPath: scratch() }, env)).toEqual([])
    expect(env.OPENCODE_MANAGED_PLUGINS).toBe("[]")
  })
})
