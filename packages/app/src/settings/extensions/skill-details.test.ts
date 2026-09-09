import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { currentSkill, payloadFor, type SkillRow } from "./skill-availability"

test("list and detail page share the availability controls and mutation owner", () => {
  const details = readFileSync(new URL("./skill-details.tsx", import.meta.url), "utf8")
  const panel = readFileSync(new URL("./panels.tsx", import.meta.url), "utf8")
  expect(details).toContain("<SkillAvailabilityControls")
  expect(panel).toContain("<SkillAvailabilityControls")
  expect(details).toContain("onChange={props.onEnabledChange}")
  expect(panel).toContain("onEnabledChange={(enabled) => void set(skill(), enabled)}")
  expect(panel).toContain("onChange={(enabled) => void set(item, enabled)}")
  expect(details).not.toContain("props.skill.location")
  expect(details).not.toContain("settings.skills.source")
})

test("disabling a selected skill keeps details open and resolves the refetched state", () => {
  const skill: SkillRow = {
    id: "review",
    name: "Review",
    description: "Review changes",
    location: "/skills/review.md",
    content: "Review the changes.",
    enabled: true,
    inherited: true,
    defaultEnabled: true,
  }
  const refreshed = { ...skill, enabled: false, inherited: false }
  expect(payloadFor(false, "default")).toEqual({ enabled: false })
  expect(payloadFor(false, "location")).toEqual({ enabled: false })
  expect(currentSkill([refreshed], skill.id)).toBe(refreshed)
  expect(currentSkill([refreshed], skill.id)?.enabled).toBe(false)
})
