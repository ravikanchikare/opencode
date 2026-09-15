export * as SkillSourceAdmission from "./source-admission.js"

import { Effect, Schema } from "effect"

const Policy = Schema.Struct({
  externalHarnesses: Schema.Boolean,
})
const decode = Schema.decodeUnknownSync(Schema.fromJsonString(Policy))

export function policy(env: Record<string, string | undefined> = process.env) {
  const raw = env.OPENCODE_MANAGED_SKILL_SOURCE_ADMISSION
  if (!raw) return Effect.succeed({ externalHarnesses: true })
  return Effect.try({
    try: () => decode(raw),
    catch: (cause) => new Error(`Invalid OPENCODE_MANAGED_SKILL_SOURCE_ADMISSION: ${String(cause)}`),
  })
}

export function allows(policy: { readonly externalHarnesses: boolean }, externalHarness: boolean) {
  return policy.externalHarnesses || !externalHarness
}
