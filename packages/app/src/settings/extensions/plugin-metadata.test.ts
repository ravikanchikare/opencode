import { expect, test } from "bun:test"
import { isPluginMetadataVisible, isPluginVisible, type AppComposition } from "@/composition"
import { hasPluginDetails } from "./plugin-options"
import type { PluginInfo } from "@opencode/client"

test("technical plugin metadata remains visible by default", () => {
  expect(isPluginMetadataVisible("acme.api", {})).toBe(true)
  expect(isPluginMetadataVisible("acme.api", { pluginPresentation: {} })).toBe(true)
})

test("metadata policy does not hide inventory rows or disable native configuration", () => {
  const composition: AppComposition = {
    pluginPresentation: { hiddenMetadataPluginIDs: ["acme.api"] },
  }
  const plugin: PluginInfo = {
    id: "acme.api",
    source: { type: "local", path: "/plugin.js" },
    features: { server: true },
    state: { status: "active" },
    options: {
      descriptors: [{ type: "multi-select", key: "domains", label: "Domains", choices: [] }],
      inherited: true,
      scope: "default",
      effective: {},
    },
  }
  expect(isPluginMetadataVisible(plugin.id, composition)).toBe(false)
  expect(isPluginVisible(plugin.id, composition)).toBe(true)
  expect(hasPluginDetails(plugin)).toBe(true)
  expect(isPluginMetadataVisible("other.plugin", composition)).toBe(true)
  expect(isPluginMetadataVisible(undefined, composition)).toBe(true)
})
