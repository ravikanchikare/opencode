export * as ConfigPolicy from "./policy.js"

import { Schema } from "effect"

export const Effect = Schema.Literals(["allow", "deny"])
export type Effect = typeof Effect.Type

/**
 * Operations a statement can govern. Both fields accept opencode's wildcard
 * syntax, so `provider.*` and `*` are patterns rather than action names:
 *
 * - `provider.use` — resource is a provider id, such as `anthropic`.
 * - `provider.model.use` — resource is `<provider>/<model>`, the same form a
 *   configured `model` uses, so `anthropic/*` and `*​/gpt-4*` both work.
 * - `integration.connect` — resource is an integration id. Its default follows
 *   the decision made for the provider that authenticates through it, so
 *   denying a provider stops offering its connection without a second
 *   statement.
 */
export const Info = Schema.Struct({
  action: Schema.String,
  resource: Schema.String,
  effect: Effect,
})
export type Info = typeof Info.Type
