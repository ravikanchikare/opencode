import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { configureAppComposition } from "@/composition"
import {
  canReset,
  currentPlugin,
  editorValues,
  hasPluginDetails,
  isSelectionActive,
  optionLabel,
  selectedValues,
} from "./plugin-options"
import type { PluginInfo } from "@opencode-ai/client"

const plugin = (overrides: Partial<PluginInfo> = {}): PluginInfo => ({
  id: "acme.packaged",
  source: { type: "local", path: "/plugin" },
  features: { server: true },
  state: { status: "active" },
  options: {
    descriptors: [],
    inherited: true,
    scope: "location",
    effective: { domains: ["alpha"] },
  },
  ...overrides,
})

describe("plugin detail destinations", () => {
  test("inventory-only plugins stay read-only", () => {
    expect(hasPluginDetails(plugin())).toBe(false)
    expect(hasPluginDetails(plugin({ options: undefined }))).toBe(false)
  })

  test("only identified, configurable plugins have a details destination", () => {
    const configurable = plugin({
      options: {
        descriptors: [{ type: "multi-select", key: "domains", label: "Domains", choices: [] }],
        inherited: true,
        scope: "default",
        effective: {},
      },
    })
    expect(hasPluginDetails(configurable)).toBe(true)
    expect(hasPluginDetails({ ...configurable, id: undefined })).toBe(false)
    expect(hasPluginDetails({ ...configurable, state: { status: "failed", error: "Setup failed" } })).toBe(true)
  })
})

describe("plugin option labels", () => {
  test("uses composition copy when present and otherwise the descriptor label", () => {
    configureAppComposition({
      pluginOptionLabels: { "acme.packaged": { domains: "API domains" } },
    })
    expect(optionLabel("acme.packaged", "domains", "Domains")).toBe("API domains")
    expect(optionLabel("other.plugin", "domains", "Domains")).toBe("Domains")
    configureAppComposition({})
  })
})

describe("plugin option reset", () => {
  test("removes an authored override at general or project scope", () => {
    expect(canReset(false, "location")).toBe(true)
    expect(canReset(false, "default")).toBe(true)
    expect(canReset(true, "location")).toBe(false)
    expect(canReset(true, "default")).toBe(false)
  })
})

describe("plugin option selected values", () => {
  test("shows effective values, not a saved request that has not activated", () => {
    expect(
      selectedValues(
        plugin({
          options: {
            descriptors: [],
            requested: { domains: ["beta"] },
            effective: { domains: ["alpha", "beta"] },
            inherited: false,
            scope: "location",
          },
        }),
        "domains",
      ),
    ).toEqual(["alpha", "beta"])
  })
})

describe("plugin option application", () => {
  test("a failed plugin is not treated as applied even when a value was saved", () => {
    const failed = plugin({
      state: { status: "failed", error: "unavailable domain: fail" },
      options: {
        descriptors: [],
        requested: { domains: ["fail"] },
        effective: { domains: ["fail"] },
        inherited: false,
        scope: "default",
      },
    })
    expect(isSelectionActive(failed, "domains")).toBe(false)
    expect(editorValues(failed, "domains")).toEqual(["fail"])
  })

  test("a requested value that differs from effective is not active", () => {
    const pending = plugin({
      options: {
        descriptors: [],
        requested: { domains: ["beta"] },
        effective: { domains: ["alpha"] },
        inherited: false,
        scope: "location",
      },
    })
    expect(isSelectionActive(pending, "domains")).toBe(false)
    expect(selectedValues(pending, "domains")).toEqual(["alpha"])
  })
})

describe("project extension plugin lookup", () => {
  test("reads the live list after save instead of a stale snapshot", () => {
    const snapshot = plugin({
      options: {
        descriptors: [],
        requested: { domains: ["alpha"] },
        effective: { domains: ["alpha"] },
        inherited: false,
        scope: "location",
      },
    })
    const live = plugin({
      options: {
        descriptors: [],
        requested: { domains: ["beta"] },
        effective: { domains: ["beta"] },
        inherited: false,
        scope: "location",
      },
    })
    expect(currentPlugin([live], String(snapshot.id))?.options?.effective).toEqual({ domains: ["beta"] })
    expect(currentPlugin([live], String(snapshot.id))).not.toBe(snapshot)
  })

  test("project Extensions editor refetches after setOptions", () => {
    const source = readFileSync(new URL("../workspaces/project-extensions.tsx", import.meta.url), "utf8")
    expect(source).toContain("currentPlugin")
    expect(source).toContain("onChanged={() => refetchPlugins()}")
    expect(source).toContain("refetchGlobalPlugins")
    expect(source).toContain("refetchProjectPlugins")
  })
})
