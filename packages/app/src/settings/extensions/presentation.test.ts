import { afterEach, expect, test } from "bun:test"
import { configureAppComposition, isPluginVisible } from "@/composition"
import {
  groupInventory,
  mcpInventoryGroups,
  pluginInventoryGroups,
  presentInventory,
  skillInventoryGroups,
  skillInventoryRows,
} from "./presentation"
import { mcpInventoryRows, pluginInventoryRows } from "./data"
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
    entries: [
      { id: "missing" },
      { id: "b", name: "Zulu", description: "Configured beta", documentationUrl: "https://example.com/beta" },
      { id: "a" },
    ],
  }
  for (const input of [rows, [...rows].reverse()]) {
    expect(presentInventory(input, presentation)).toEqual([
      {
        id: "b",
        name: "Zulu",
        description: "Configured beta",
        documentationUrl: "https://example.com/beta",
        enabled: true,
      },
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
      hiddenIDs: ["hidden"],
      entries: [{ id: "api", name: "API", description: "Configured description" }],
    },
  })
  const rows = pluginInventoryRows([{ ...plugin, id: "hidden" }, plugin])
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ id: "api", name: "API", description: "Configured description" })
  expect(rows[0].options).toBe(plugin.options)
  expect(rows[0].state).toBe(plugin.state)
})

test("plugin groups use presented order and keep failed unconfigured rows in a trailing section", () => {
  const rows: PluginInfo[] = [
    {
      id: "third.party",
      source: { type: "local", path: "/third-party.js" },
      features: { server: true },
      state: { status: "failed", error: "Failed to start" },
    },
    {
      id: "api",
      name: "Native API",
      source: { type: "local", path: "/api.js" },
      features: { server: true },
      state: { status: "active" },
    },
    {
      id: "hidden",
      name: "Hidden",
      source: { type: "local", path: "/hidden.js" },
      features: { server: true },
      state: { status: "active" },
    },
  ]
  configureAppComposition({
    pluginPresentation: {
      hiddenIDs: ["hidden"],
      entries: [{ id: "api", name: "API", group: "essentials" }],
      groups: [{ id: "essentials", title: "Essentials" }],
    },
  })
  const presented = pluginInventoryRows(rows)
  const sections = pluginInventoryGroups(presented)
  expect(
    sections.map((section) => ({
      group: section.group?.id,
      rows: section.rows.map((row) => [row.id, row.name]),
    })),
  ).toEqual([
    { group: "essentials", rows: [["api", "API"]] },
    { group: undefined, rows: [["third.party", undefined]] },
  ])
  expect(sections[1].rows[0].state).toBe(rows[0].state)

  configureAppComposition({})
  const flat = pluginInventoryRows(rows)
  expect(pluginInventoryGroups(flat)).toEqual([{ rows: flat }])
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

test("Settings-only hiding does not mutate the source skill inventory", () => {
  const rows = [
    { id: "opencode", name: "OpenCode", autoinvoke: true },
    { id: "report", name: "Report", autoinvoke: true },
    { id: "custom", name: "Custom", autoinvoke: true },
  ]
  configureAppComposition({ skillPresentation: { hiddenIDs: ["opencode", "report"] } })
  expect(skillInventoryRows(rows).map((row) => row.id)).toEqual(["custom"])
  expect(rows.map((row) => row.id)).toEqual(["opencode", "report", "custom"])
  expect(rows.every((row) => row.autoinvoke)).toBe(true)
  expect(isPluginVisible("hidden", { pluginPresentation: { hiddenIDs: ["hidden"] } })).toBe(false)
})

test("inventory without groups remains one untitled section identical to flat presentation", () => {
  const rows = [
    { id: "b", name: "Beta" },
    { id: "a", name: "Alpha" },
  ]
  const presented = presentInventory(rows, { entries: [{ id: "a", name: "First" }, { id: "b" }] })
  expect(groupInventory(presented, { entries: [{ id: "a", name: "First" }, { id: "b" }] })).toEqual([
    { rows: presented },
  ])
})

test("configured groups with no rows produce one untitled empty section", () => {
  expect(
    groupInventory([], {
      entries: [{ id: "missing", group: "known" }],
      groups: [{ id: "known", title: "Known" }],
    }),
  ).toEqual([{ rows: [] }])
})

test("group order follows first entry appearance while rows retain presented order and overrides", () => {
  const rows = [
    { id: "a", name: "Alpha", description: "Native alpha" },
    { id: "b", name: "Beta", description: "Native beta" },
    { id: "c", name: "Gamma", description: "Native gamma" },
  ]
  configureAppComposition({
    skillPresentation: {
      entries: [
        { id: "b", name: "Configured beta", group: "second" },
        { id: "a", description: "Configured alpha", group: "first" },
        { id: "c", group: "second" },
      ],
      groups: [
        { id: "first", title: "First" },
        { id: "second", title: "Second", description: "Second group" },
      ],
    },
  })
  expect(skillInventoryGroups(skillInventoryRows(rows))).toEqual([
    {
      group: { id: "second", title: "Second", description: "Second group" },
      rows: [
        { id: "b", name: "Configured beta", description: "Native beta" },
        { id: "c", name: "Gamma", description: "Native gamma" },
      ],
    },
    {
      group: { id: "first", title: "First" },
      rows: [{ id: "a", name: "Alpha", description: "Configured alpha" }],
    },
  ])
})

test("unknown, ungrouped, and unconfigured rows share one trailing untitled section", () => {
  const rows = [
    { id: "hidden", name: "Hidden" },
    { id: "configured", name: "Configured" },
    { id: "unknown", name: "Unknown" },
    { id: "ungrouped", name: "Ungrouped" },
    { id: "extra", name: "Extra" },
  ]
  configureAppComposition({
    skillPresentation: {
      hiddenIDs: ["hidden"],
      entries: [{ id: "configured", group: "known" }, { id: "unknown", group: "missing" }, { id: "ungrouped" }],
      groups: [{ id: "known", title: "Known" }],
    },
  })
  expect(skillInventoryGroups(skillInventoryRows(rows))).toEqual([
    {
      group: { id: "known", title: "Known" },
      rows: [{ id: "configured", name: "Configured" }],
    },
    {
      rows: [
        { id: "unknown", name: "Unknown" },
        { id: "ungrouped", name: "Ungrouped" },
        { id: "extra", name: "Extra" },
      ],
    },
  ])
})

test("MCP labels and descriptions never replace the connection ID", () => {
  configureAppComposition({
    mcpPresentation: {
      entries: [{ id: "internal-server", name: "Internal Server", description: "Internal context." }],
    },
  })
  expect(mcpInventoryRows([{ name: "internal-server", enabled: false }])).toEqual([
    { id: "internal-server", name: "Internal Server", description: "Internal context.", enabled: false },
  ])
  configureAppComposition({})
  expect(mcpInventoryRows([{ name: "internal-server", enabled: true }])).toEqual([
    { id: "internal-server", name: "internal-server", enabled: true },
  ])
})

test("MCP presentation groups project and shared inventories with the root headings", () => {
  configureAppComposition({
    mcpPresentation: {
      entries: [
        { id: "project", group: "automation" },
        { id: "shared", group: "automation" },
      ],
      groups: [{ id: "automation", title: "Agents & Automation" }],
    },
  })
  expect(mcpInventoryGroups([{ id: "project" }])).toEqual([
    { group: { id: "automation", title: "Agents & Automation" }, rows: [{ id: "project" }] },
  ])
  expect(mcpInventoryGroups([{ id: "shared" }])).toEqual([
    { group: { id: "automation", title: "Agents & Automation" }, rows: [{ id: "shared" }] },
  ])
})
