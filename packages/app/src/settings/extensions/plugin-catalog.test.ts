import { describe, expect, test } from "bun:test"
import { filterPluginChoices } from "./plugin-catalog"

const choices = [
  {
    value: "brands",
    label: "Brands",
    tools: [
      { name: "brands.get", description: "Get a brand" },
      { name: "brands.create", description: "Create a brand" },
    ],
  },
  { value: "tables", label: "Tables", tools: [{ name: "tables.get", description: "Read a table" }] },
  { value: "legacy", label: "Legacy choice", description: "Without a catalog" },
]

describe("plugin catalog search", () => {
  test("blank queries preserve all choices including older plugins without metadata", () => {
    expect(filterPluginChoices(choices, "  ").map((row) => row.choice.value)).toEqual(["brands", "tables", "legacy"])
  })
  test("domain matches preserve their full catalog", () => {
    expect(filterPluginChoices(choices, " BRANDS ")[0]?.tools).toHaveLength(2)
  })
  test("operation search reveals only matches and does not change the catalog", () => {
    const result = filterPluginChoices(choices, "CREATE")
    expect(result.map((row) => row.choice.value)).toEqual(["brands"])
    expect(result[0]?.tools.map((tool) => tool.name)).toEqual(["brands.create"])
    expect(choices[0]?.tools).toHaveLength(2)
  })
  test("searches descriptions and supports no results", () => {
    expect(filterPluginChoices(choices, "Read a table")[0]?.choice.value).toBe("tables")
    expect(filterPluginChoices(choices, "Without a catalog")[0]?.choice.value).toBe("legacy")
    expect(filterPluginChoices(choices, "missing")).toEqual([])
  })
})
