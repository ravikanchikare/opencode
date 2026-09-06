import { describe, expect, test } from "bun:test"
import { configureAppComposition } from "@/composition"
import { canReset, optionLabel, selectedValues } from "./plugin-options"

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
  test("only a project override can restore the default selection", () => {
    expect(canReset(false, "location")).toBe(true)
    expect(canReset(true, "location")).toBe(false)
    expect(canReset(false, "default")).toBe(false)
  })
})

describe("plugin option selected values", () => {
  test("reads requested values at the current scope and falls back to effective", () => {
    expect(
      selectedValues(
        {
          source: { type: "local", path: "/plugin" },
          features: { server: true },
          state: { status: "active" },
          options: {
            descriptors: [],
            requested: { domains: ["beta"] },
            effective: { domains: ["alpha", "beta"] },
            inherited: false,
            scope: "location",
          },
        },
        "domains",
      ),
    ).toEqual(["beta"])
    expect(
      selectedValues(
        {
          source: { type: "local", path: "/plugin" },
          features: { server: true },
          state: { status: "active" },
          options: {
            descriptors: [],
            effective: { domains: ["alpha"] },
            inherited: true,
            scope: "location",
          },
        },
        "domains",
      ),
    ).toEqual(["alpha"])
  })
})
