import { describe, expect, test } from "bun:test"
import type { SettingsTabEntry } from "@/composition"
import { groupSettingsTabs } from "./tabs"

const tab = (value: string, before?: string): SettingsTabEntry =>
  ({ value, label: value, icon: "mcp", content: () => null, ...(before ? { before } : {}) }) as SettingsTabEntry

describe("groupSettingsTabs", () => {
  test("preserves stock groups and anchors composed tabs", () => {
    expect(groupSettingsTabs([tab("integrations", "extensions")], new Set(["servers", "mcp", "plugins", "skills"]))).toEqual([
      ["general", "appearance", "notifications", "shortcuts"],
      ["projects", "workspaces"],
      ["providers", "models", "integrations", "extensions"],
    ])
  })

  test("uses a composed grouping declaration", () => {
    expect(
      groupSettingsTabs(
        [tab("integrations"), tab("references")],
        new Set(["servers", "extensions", "mcp", "plugins", "skills"]),
        [
          ["general"],
          ["appearance", "notifications", "shortcuts"],
          ["projects", "workspaces"],
          ["providers", "models", "integrations"],
          ["references"],
        ],
      ),
    ).toEqual([
      ["general"],
      ["appearance", "notifications", "shortcuts"],
      ["projects", "workspaces"],
      ["providers", "models", "integrations"],
      ["references"],
    ])
  })

  test("groups split stock extension views with references", () => {
    expect(
      groupSettingsTabs([tab("integrations"), tab("references")], new Set(["servers", "extensions"]), [
        ["general"],
        ["appearance", "notifications", "shortcuts"],
        ["projects", "workspaces"],
        ["providers", "models", "integrations"],
        ["references", "mcp", "plugins", "skills"],
      ]),
    ).toEqual([
      ["general"],
      ["appearance", "notifications", "shortcuts"],
      ["projects", "workspaces"],
      ["providers", "models", "integrations"],
      ["references", "mcp", "plugins", "skills"],
    ])
  })

  test("keeps omitted visible tabs reachable and ignores duplicates and unknown values", () => {
    expect(
      groupSettingsTabs(
        [tab("integrations")],
        new Set(["servers", "mcp", "plugins", "skills"]),
        [["general", "general", "missing"]],
      ),
    ).toEqual(
      [
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
          "integrations",
        ],
      ],
    )
  })
})
