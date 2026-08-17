export * as ProviderAllowlistPlugin from "./provider-allowlist.js"

import { Effect, Option, Schema } from "effect"
import { define } from "@opencode-ai/plugin/effect/plugin"

const Allowlist = Schema.Struct({
  providers: Schema.Array(Schema.String),
  integrations: Schema.Array(Schema.String).pipe(Schema.optional),
  models: Schema.Record(Schema.String, Schema.Array(Schema.String)).pipe(Schema.optional),
})
type Allowlist = Schema.Schema.Type<typeof Allowlist>
const decodeAllowlist = Schema.decodeUnknownOption(Schema.fromJsonString(Allowlist))

/**
 * Restricts the provider/model catalog to an operator-defined allowlist read
 * from the `OPENCODE_PROVIDER_ALLOWLIST` environment variable:
 *
 *   OPENCODE_PROVIDER_ALLOWLIST='{"providers":["anthropic","acme"],"integrations":["devrev"],"models":{"anthropic":["claude-sonnet-4-5"]}}'
 *
 * `providers` rules the served catalog and, via each provider's `integrationID`,
 * the integrations those providers authenticate through. `integrations` names
 * integration ids worth keeping even though no provider references them — a
 * pure tool connection such as `devrev` has no catalog record. Both lists seed
 * the integration keep-set, so an id may appear in either.
 *
 * A missing or malformed value leaves the catalog unrestrained; this is a
 * launch-time distribution lever, not a user-facing capability. Registered last
 * in the internal `post` chain (packages/core/src/plugin/internal.ts) so the
 * removal replays after every other catalog transform on each reload.
 */
export const Plugin = define({
  id: "opencode.provider-allowlist",
  effect: Effect.fn(function* (ctx) {
    const raw = typeof process === "undefined" ? undefined : process.env.OPENCODE_PROVIDER_ALLOWLIST
    if (!raw) return
    const decoded = decodeAllowlist(raw)
    if (Option.isNone(decoded)) {
      yield* Effect.logError("ignoring invalid OPENCODE_PROVIDER_ALLOWLIST; catalog is unrestrained", { value: raw })
      return
    }
    const allowlist = decoded.value
    const allowed = new Set(allowlist.providers)

    // Integration ids that must survive the pass below: ids explicitly listed
    // under `integrations`, plus every allowlisted provider's own
    // `integrationID` (a provider may authenticate through an integration named
    // differently from itself). Populated by the catalog pass and read by the
    // integration pass; both replay on every rebuild, so it converges after
    // the first.
    const allowedIntegrations = new Set<string>([
      ...allowlist.providers,
      ...(allowlist.integrations ?? []),
    ])

    yield* ctx.catalog.transform((catalog) => {
      for (const record of catalog.provider.list()) {
        if (!allowed.has(record.provider.id)) {
          catalog.provider.remove(record.provider.id)
          continue
        }
        if (record.provider.integrationID) allowedIntegrations.add(record.provider.integrationID)
        const keep = new Set(allowlist.models?.[record.provider.id])
        if (keep.size === 0) continue
        for (const modelID of record.models.keys()) {
          if (!keep.has(modelID)) catalog.model.remove(record.provider.id, modelID)
        }
      }
    })

    // Restricting the catalog alone leaves the "Connect provider" dialog
    // offering every provider, because that list comes from `integration.list`
    // rather than the catalog. An operator restricting the catalog does not
    // expect users to still be able to authenticate providers whose models can
    // never appear, so the same allowlist governs both.
    yield* ctx.integration.transform((integrations) => {
      for (const integration of integrations.list()) {
        if (!allowedIntegrations.has(integration.id)) integrations.remove(integration.id)
      }
    })
  }),
})