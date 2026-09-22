import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { configureAppComposition } from "@/composition"
import {
  canReset,
  currentPlugin,
  editorValues,
  hasManyPluginTools,
  hasPluginDetails,
  isSelectionActive,
  optionLabel,
  selectedValues,
} from "./plugin-options"
import type { PluginInfo } from "@opencode/client"

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

describe("plugin tool utilities", () => {
  const withTools = (count: number) =>
    plugin({
      options: {
        descriptors: [
          {
            type: "multi-select",
            key: "tools",
            label: "Tools",
            choices: Array.from({ length: count }, (_, index) => ({
              value: `tool-${index}`,
              label: `Tool ${index}`,
              tools: [{ name: `tool-${index}`, description: `Tool ${index}` }],
            })),
          },
        ],
        inherited: true,
        scope: "default",
        effective: {},
      },
    })

  test("shows search and bulk actions only above eight tools", () => {
    expect(hasManyPluginTools(withTools(8))).toBe(false)
    expect(hasManyPluginTools(withTools(9))).toBe(true)
  })

  test("counts tools in functional-group children", () => {
    expect(
      hasManyPluginTools(
        plugin({
          options: {
            descriptors: [
              {
                type: "multi-select",
                key: "tools",
                label: "Tools",
                choices: [{
                  value: "data",
                  label: "Data",
                  children: withTools(9).options!.descriptors[0]!.choices.map((choice) => ({
                    ...choice,
                    group: { id: choice.value, label: choice.label },
                  })),
                }],
              },
            ],
            inherited: true,
            scope: "default",
            effective: {},
          },
        }),
      ),
    ).toBe(true)
  })

  test("the editor applies the threshold and uses the stock code icon for input schemas", () => {
    const source = readFileSync(new URL("./plugin-options-editor.tsx", import.meta.url), "utf8")
    expect(source).toContain("showToolUtilities")
    expect(source).toContain("<Show when={showToolUtilities()}>")
    expect(source).toContain('class="plugin-options" data-plugin-id={pluginId()}')
    expect(source).toContain('class="plugin-input-schema-trigger"')
    expect(source).toContain('<Icon name="code-slash" size="small" />')
    expect(source).not.toContain('name="braces"')
    expect(source).not.toContain("<Collapsible.Arrow />\n          {language.t(\"settings.plugins.input\")}")
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
  test("an absent field uses its default even when another field has an override", () => {
    const defaults = plugin({
      options: {
        descriptors: [],
        requested: { other: ["value"] },
        effective: { other: ["value"] },
        inherited: false,
        scope: "default",
      },
    })
    expect(isSelectionActive(defaults, "tools")).toBe(true)
    expect(editorValues(defaults, "tools", ["read"])).toEqual(["read"])
  })

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
    expect(source).toContain("pluginInventoryRows")
    expect(source).toContain('class="plugin-options-open"')
    expect(source).toContain("currentPlugin")
    expect(source).toContain("PluginOptionsEditor")
    expect(source).toContain("onChanged={() => refetchPlugins()}")
    expect(source).toContain("refetchGlobalPlugins")
    expect(source).toContain("refetchProjectPlugins")
  })
})
