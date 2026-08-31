import { describe, expect, test } from "bun:test"
import type { PluginInfo, SkillInventory } from "@opencode-ai/client"
import { pluginRows, skillKey, splitInventory } from "./extension-inventory"

const plugin = (id: string): PluginInfo => ({
  id,
  source: { type: "package", package: id },
  features: { server: true },
  state: { status: "active" },
  toggleable: true,
})

const skill = (id: string, enabled: boolean): SkillInventory => ({
  id,
  name: "Same display name",
  location: `/skills/${id}/SKILL.md`,
  content: id,
  enabled,
  inherited: true,
  defaultEnabled: true,
})

describe("extension inventory", () => {
  test("keeps failed plugins visible while excluding builtins", () => {
    expect(
      pluginRows([
        plugin("active"),
        {
          source: { type: "package", package: "broken" },
          features: { server: true },
          state: { status: "failed", error: "boom" },
          toggleable: false,
        },
        {
          id: "builtin",
          source: { type: "builtin" },
          features: { server: true },
          state: { status: "active" },
          toggleable: false,
        },
      ]),
    ).toEqual([
      expect.objectContaining({ id: "active", enabled: true }),
      expect.objectContaining({ name: "broken", enabled: false, state: { status: "failed", error: "boom" } }),
    ])
  })

  test("uses current location state for shared candidates", () => {
    const global = [skill("review", true)]
    const current = [skill("review", false), skill("deploy", true)]

    expect(splitInventory(current, global, skillKey)).toEqual({
      added: [skill("deploy", true)],
      shared: [skill("review", false)],
    })
  })

  test("keeps duplicate skill display names independently addressable", () => {
    const items = [skill("first", false), skill("second", true)]
    expect(items.map(skillKey)).toEqual(["first", "second"])
  })
})
