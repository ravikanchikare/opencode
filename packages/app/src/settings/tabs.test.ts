import { describe, expect, test } from "bun:test"
import type { SettingsTabEntry } from "@/composition"
import type { SettingsNavGroup } from "./navigation"
import { composeSettingsNavGroups } from "./tabs"

const tab = (value: string, before?: string): SettingsTabEntry =>
  ({ value, label: value, icon: "mcp", content: () => null, ...(before ? { before } : {}) }) as SettingsTabEntry

const item = (value: string) => ({ value, label: value, icon: "sliders" as const })

/** The host's root groups, single-server branch. */
const stock: SettingsNavGroup[] = [
  { items: ["general", "appearance", "notifications", "shortcuts"].map(item) },
  { items: ["projects", "workspaces", "providers", "models", "extensions", "servers"].map(item) },
  { items: [item("experimental")] },
  { items: [item("about")] },
]

const values = (groups: readonly SettingsNavGroup[]) => groups.map((group) => group.items.map((entry) => entry.value))

describe("composeSettingsNavGroups", () => {
  test("leaves the host's groups alone without a composition", () => {
    expect(composeSettingsNavGroups(stock)).toEqual(stock)
  })

  test("hides tabs, drops groups left empty, and anchors a composed tab in place", () => {
    const groups = composeSettingsNavGroups(stock, {
      hide: ["appearance", "experimental"],
      add: [tab("integrations", "extensions")],
    })
    expect(values(groups)).toEqual([
      ["general", "notifications", "shortcuts"],
      ["projects", "workspaces", "providers", "models", "integrations", "extensions", "servers"],
      ["about"],
    ])
  })

  test("appends composed tabs whose anchor names nothing visible", () => {
    const groups = composeSettingsNavGroups(stock, { hide: ["extensions"], add: [tab("integrations", "extensions")] })
    expect(values(groups).at(-1)).toEqual(["integrations"])
  })

  test("carries host item state through by reference", () => {
    const prefetch = () => {}
    const source: SettingsNavGroup[] = [
      { items: [item("general"), { ...item("workspaces"), disabled: true, onPrefetch: prefetch }] },
    ]
    const groups = composeSettingsNavGroups(source, { add: [tab("references")], groups: [["workspaces", "general"]] })
    expect(groups[0].items[0]).toMatchObject({ value: "workspaces", disabled: true, onPrefetch: prefetch })
  })

  test("keeps a labelled server group whole and out of the declaration", () => {
    const action = "add"
    const source: SettingsNavGroup[] = [
      { items: ["general", "appearance"].map(item) },
      { label: "Servers", action, items: ["server:alpha", "server:beta"].map(item) },
      { items: [item("about")] },
    ]
    const groups = composeSettingsNavGroups(source, { hide: ["appearance"], groups: [["general"], ["about"]] })
    expect(values(groups)).toEqual([["general"], ["about"], ["server:alpha", "server:beta"]])
    expect(groups[2]).toMatchObject({ label: "Servers", action })
  })

  test("keeps undeclared visible tabs reachable and ignores duplicates and unknown values", () => {
    const groups = composeSettingsNavGroups(stock, {
      hide: ["servers"],
      add: [tab("integrations")],
      groups: [["general", "general", "missing"]],
    })
    expect(values(groups)).toEqual([
      ["general"],
      [
        "appearance",
        "notifications",
        "shortcuts",
        "projects",
        "workspaces",
        "providers",
        "models",
        "extensions",
        "experimental",
        "about",
        "integrations",
      ],
    ])
  })

  // The distribution this fork exists for: the stock Extensions tab is replaced
  // by MCP, Plugins and Skills destinations, and References is its own.
  test("produces the distribution's destinations", () => {
    const groups = composeSettingsNavGroups(stock, {
      hide: ["appearance", "experimental", "about", "servers", "extensions"],
      add: [tab("skills"), tab("mcp"), tab("plugins"), tab("code-references")],
      groups: [
        ["general", "notifications", "shortcuts"],
        ["projects", "workspaces"],
        ["providers", "models"],
        ["skills", "mcp", "plugins", "code-references"],
      ],
    })
    expect(values(groups)).toEqual([
      ["general", "notifications", "shortcuts"],
      ["projects", "workspaces"],
      ["providers", "models"],
      ["skills", "mcp", "plugins", "code-references"],
    ])
  })
})
