import { describe, expect, test } from "bun:test"
import { SkillSourceAdmission } from "@opencode-ai/core/skill/source-admission"
import { Effect, Exit } from "effect"

describe("SkillSourceAdmission", () => {
  test("admits external harness sources without managed policy", async () => {
    const policy = await Effect.runPromise(SkillSourceAdmission.policy({}))

    expect(policy).toEqual({ externalHarnesses: true })
    expect(SkillSourceAdmission.allows(policy, true)).toBe(true)
  })

  test("decodes external harness admission", async () => {
    const policy = await Effect.runPromise(
      SkillSourceAdmission.policy({
        OPENCODE_MANAGED_SKILL_SOURCE_ADMISSION: JSON.stringify({ externalHarnesses: false }),
      }),
    )

    expect(policy).toEqual({ externalHarnesses: false })
    expect(SkillSourceAdmission.allows(policy, true)).toBe(false)
    expect(SkillSourceAdmission.allows(policy, false)).toBe(true)
  })

  test("rejects malformed policy", async () => {
    const result = await Effect.runPromiseExit(
      SkillSourceAdmission.policy({ OPENCODE_MANAGED_SKILL_SOURCE_ADMISSION: '{"externalHarnesses":"false"}' }),
    )

    expect(Exit.isFailure(result)).toBe(true)
  })
})
