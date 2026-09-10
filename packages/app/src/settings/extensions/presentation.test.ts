import { afterEach, expect, test } from "bun:test"
import { configureAppComposition } from "@/composition"
import { presentInventory, skillInventoryRows } from "./presentation"
import { pluginInventoryRows } from "./data"
import type { PluginInfo } from "@opencode/client"

afterEach(() => configureAppComposition({}))

test("absent presentation preserves native order, metadata, and row identity", () => {
  const rows = [
    { id: "b", name: "Beta" },
    { id: "a", name: "Alpha" },
  ]
  expect(presentInventory(rows)).toEqual(rows)
  expect(presentInventory(rows)[0]).toBe(rows[0])
})

test("configured array order wins over API order and alphabetical names", () => {
  const rows: readonly { id: string; name: string; description: string; enabled: boolean }[] = [
    Object.freeze({ id: "a", name: "Alpha", description: "Native alpha", enabled: false }),
    Object.freeze({ id: "b", name: "Beta", description: "Native beta", enabled: true }),
  ]
  const presentation = {
    entries: [{ id: "missing" }, { id: "b", name: "Zulu", description: "Configured beta" }, { id: "a" }],
  }
  for (const input of [rows, [...rows].reverse()]) {
    expect(presentInventory(input, presentation)).toEqual([
      { id: "b", name: "Zulu", description: "Configured beta", enabled: true },
      rows[0],
    ])
  }
  expect(rows[1].name).toBe("Beta")
  expect(rows[1].description).toBe("Native beta")
})

test("unconfigured and unidentified rows follow configured rows without being dropped", () => {
  const rows = [{ id: "x" }, { name: "Unidentified" }, { id: "b" }, { id: "a" }]
  expect(presentInventory(rows, { entries: [{ id: "a" }, { id: "b" }] })).toEqual([rows[3], rows[2], rows[0], rows[1]])
})

test("plugin filtering and presentation keep native state and options intact", () => {
  const plugin: PluginInfo = {
    id: "api",
    name: "Native",
    source: { type: "local", path: "/api.js" },
    features: { server: true },
    state: { status: "active" },
    options: { descriptors: [], scope: "default", inherited: true, effective: { domains: ["a"] } },
  }
  configureAppComposition({
    pluginPresentation: {
      hiddenPluginIDs: ["hidden"],
      entries: [{ id: "api", name: "API", description: "Configured description" }],
    },
  })
  const rows = pluginInventoryRows([{ ...plugin, id: "hidden" }, plugin])
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ id: "api", name: "API", description: "Configured description" })
  expect(rows[0].options).toBe(plugin.options)
  expect(rows[0].state).toBe(plugin.state)
})

test("skill presentation uses configured order while retaining descriptions and disabled entries", () => {
  const rows = [
    { id: "a", name: "Alpha", description: "Alpha instructions", enabled: false },
    { id: "b", name: "Beta", description: "Beta instructions", enabled: true },
  ]
  configureAppComposition({ skillPresentation: { entries: [{ id: "b" }, { id: "a" }] } })
  expect(skillInventoryRows(rows)).toEqual([rows[1], rows[0]])
  configureAppComposition({})
  expect(skillInventoryRows([...rows].reverse())).toEqual(rows)
})
