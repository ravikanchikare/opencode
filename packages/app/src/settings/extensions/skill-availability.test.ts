import { describe, expect, test } from "bun:test"

import {
  availabilityKey,
  canReset,
  currentSkill,
  detailOf,
  ordered,
  payloadFor,
  scopeOf,
  type SkillRow,
} from "./skill-availability"

const row = (overrides: Partial<SkillRow> = {}): SkillRow => ({
  id: "review",
  name: "Review",
  enabled: true,
  inherited: true,
  defaultEnabled: true,
  location: "/skills/review/SKILL.md",
  content: "# Review\nFollow the checklist.",
  ...overrides,
})

describe("scopeOf", () => {
  test("a Settings window with no directory edits the global default", () => {
    expect(scopeOf(undefined)).toBe("default")
    expect(scopeOf("/work/project")).toBe("location")
  })
})

describe("canReset", () => {
  /**
   * The reset control is the whole reason scope has to be explicit here. The
   * host reports `inherited: false` for every row in default scope — there is
   * no outer scope for a global value to inherit from — so a check on
   * `inherited` alone would offer "Use default" on every global row.
   */
  test("never offers a reset in global scope, whatever inherited says", () => {
    expect(canReset(row({ inherited: false }), "default")).toBe(false)
    expect(canReset(row({ inherited: true }), "default")).toBe(false)
  })

  test("offers a reset in a project only when that project overrides", () => {
    expect(canReset(row({ inherited: false }), "location")).toBe(true)
    expect(canReset(row({ inherited: true }), "location")).toBe(false)
  })
})

describe("payloadFor", () => {
  test("sends an explicit value in either scope", () => {
    expect(payloadFor(false, "default")).toEqual({ enabled: false })
    expect(payloadFor(true, "location")).toEqual({ enabled: true })
  })

  test("'use default' clears only the project override", () => {
    expect(payloadFor(undefined, "location")).toEqual({ inherit: true })
  })

  test("refuses to clear the global default, which has nothing to inherit", () => {
    expect(() => payloadFor(undefined, "default")).toThrow(/cannot inherit/)
  })
})

describe("detailOf", () => {
  test("global scope names a default that is off and stays quiet otherwise", () => {
    expect(detailOf(row({ enabled: false }), "default")).toBe("Off by default in every project")
    expect(detailOf(row({ enabled: true }), "default")).toBeUndefined()
  })

  test("project scope speaks up only where the project departs from the default", () => {
    expect(detailOf(row({ inherited: true }), "location")).toBeUndefined()
    expect(detailOf(row({ inherited: false, defaultEnabled: true }), "location")).toBe(
      "Overrides the default: on elsewhere",
    )
    expect(detailOf(row({ inherited: false, defaultEnabled: false }), "location")).toBe(
      "Overrides the default: off elsewhere",
    )
  })
})

describe("ordered", () => {
  test("sorts by name, then id, without mutating the input", () => {
    const rows = [
      { id: "b", name: "Same" },
      { id: "a", name: "Same" },
      { id: "c", name: "Alpha" },
    ]
    expect(ordered(rows).map((item) => item.id)).toEqual(["c", "a", "b"])
    expect(rows.map((item) => item.id)).toEqual(["b", "a", "c"])
  })
})

describe("skill details navigation", () => {
  const skills = [
    row({ id: "enabled", name: "Enabled skill", enabled: true }),
    row({ id: "disabled", name: "Disabled skill", enabled: false, slash: true, autoinvoke: false }),
  ]

  test("selects the current inventory row, including a disabled skill, and returns to the list on back", () => {
    let selected: string | undefined = "disabled"
    expect(currentSkill(skills, selected)).toMatchObject({
      id: "disabled",
      enabled: false,
      location: "/skills/review/SKILL.md",
      content: "# Review\nFollow the checklist.",
    })
    selected = undefined
    expect(currentSkill(skills, selected)).toBeUndefined()
  })

  test("presents resolved global defaults and project availability context", () => {
    expect(availabilityKey(skills[1], "default")).toBe("settings.skills.availability.default.disabled")
    expect(availabilityKey(row({ enabled: true, inherited: true }), "location")).toBe(
      "settings.skills.availability.inherited.enabled",
    )
    expect(availabilityKey(row({ enabled: false, inherited: false, defaultEnabled: true }), "location")).toBe(
      "settings.skills.availability.override.disabled.defaultEnabled",
    )
    expect(availabilityKey(row({ enabled: true, inherited: false, defaultEnabled: false }), "location")).toBe(
      "settings.skills.availability.override.enabled.defaultDisabled",
    )
  })
})
