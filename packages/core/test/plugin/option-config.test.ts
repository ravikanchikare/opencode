import { describe, expect, test } from "bun:test"
import { Document } from "@opencode-ai/schema/config"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { PluginOptionConfig } from "@opencode-ai/core/plugin/option-config"
import { PluginOptions } from "@opencode-ai/core/plugin/options"

describe("PluginOptions.publicValues", () => {
  test("omits secret option keys from a generic read", () => {
    expect(
      PluginOptions.publicValues(
        { token: "secret", domains: ["alpha"] },
        [
          {
            type: "multi-select",
            key: "domains",
            label: "Domains",
            choices: [{ value: "alpha", label: "Alpha" }],
          },
          {
            type: "multi-select",
            key: "token",
            label: "Token",
            choices: [],
            secret: true,
          },
        ],
      ),
    ).toEqual({ domains: ["alpha"] })
  })
})

describe("PluginOptions.merge", () => {
  test("later keys win and arrays replace", () => {
    expect(
      PluginOptions.merge({ domains: ["a", "b"], timeoutMs: 1, nested: { keep: true } }, { domains: [], timeoutMs: 2 }),
    ).toEqual({ domains: [], timeoutMs: 2, nested: { keep: true } })
  })
})

describe("PluginOptionConfig.upsert", () => {
  test("adds an exact-ID override, then removing the key drops the entry", () => {
    const added = PluginOptionConfig.upsert(["other"], "acme.packaged", "domains", ["beta"])
    expect(added).toEqual(["other", { package: "acme.packaged", options: { domains: ["beta"] } }])
    expect(PluginOptionConfig.upsert(added, "acme.packaged", "domains", undefined)).toEqual(["other"])
  })

  test("converts a string selector into an options object without dropping it", () => {
    expect(PluginOptionConfig.upsert(["acme.packaged"], "acme.packaged", "domains", [])).toEqual([
      { package: "acme.packaged", options: { domains: [] } },
    ])
  })
})

describe("PluginOptionConfig.authored", () => {
  test("treats project documents as location overrides and global documents as defaults", () => {
    const global = "/tmp/config"
    const directory = "/tmp/project"
    const entries = [
      new Document({
        type: "document",
        path: AbsolutePath.make(`${global}/opencode.json`),
        info: { plugins: [{ package: "acme.packaged", options: { domains: ["alpha"] } }] },
      }),
      new Document({
        type: "document",
        path: AbsolutePath.make(`${directory}/.opencode/opencode.json`),
        info: { plugins: [{ package: "acme.packaged", options: { domains: ["beta"] } }] },
      }),
    ]
    expect(PluginOptionConfig.authored(entries, "acme.packaged", "default", global, directory)).toEqual({
      requested: { domains: ["alpha"] },
      inherited: false,
    })
    expect(PluginOptionConfig.authored(entries, "acme.packaged", "location", global, directory)).toEqual({
      requested: { domains: ["beta"] },
      inherited: false,
    })
    expect(PluginOptionConfig.authored(entries, "missing", "location", global, directory)).toEqual({
      requested: undefined,
      inherited: true,
    })
  })
})
