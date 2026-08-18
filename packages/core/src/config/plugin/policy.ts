export * as ConfigPolicyPlugin from "./policy.js"

import { define } from "@opencode-ai/plugin/effect/plugin"
import { Document } from "@opencode-ai/schema/config"
import { ConfigPolicy } from "@opencode-ai/schema/config/policy"
import { Effect, Option, Schema, Stream } from "effect"
import { Config } from "../../config.js"
import { Wildcard } from "../../util/wildcard.js"

const decodeManaged = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Array(ConfigPolicy.Info)))

/**
 * Policy statements supplied by whoever operates this installation, rather than
 * authored in a config document.
 *
 * specs/v2/provider-policy.md reserves this tier and gives it final authority —
 * managed statements are appended after the reversed authored statements, so a
 * repository or a user cannot re-allow what the operator denied. It leaves the
 * delivery mechanism undefined; `OPENCODE_MANAGED_POLICY` carries a JSON array
 * of statements in the authored vocabulary:
 *
 *   OPENCODE_MANAGED_POLICY='[{"effect":"deny","action":"provider.use","resource":"*"},
 *                             {"effect":"allow","action":"provider.use","resource":"anthropic"}]'
 *
 * Unset leaves evaluation exactly as authored. Malformed input is a logged
 * no-op: a distribution that cannot parse its own policy should still boot,
 * because failing closed here would deny every provider and failing loudly at
 * startup would take the app down.
 */
const managed = Effect.fn(function* () {
  const raw = typeof process === "undefined" ? undefined : process.env.OPENCODE_MANAGED_POLICY
  if (!raw) return [] as readonly ConfigPolicy.Info[]
  const decoded = decodeManaged(raw)
  if (Option.isNone(decoded)) {
    yield* Effect.logError("ignoring invalid OPENCODE_MANAGED_POLICY; only authored policy applies", { value: raw })
    return [] as readonly ConfigPolicy.Info[]
  }
  return decoded.value
})

/** Matching statements apply in order and the last one wins; each caller supplies its own default. */
const evaluate = (
  policies: readonly ConfigPolicy.Info[],
  action: string,
  resource: string,
  fallback: ConfigPolicy.Effect,
) =>
  policies.findLast((policy) => Wildcard.match(action, policy.action) && Wildcard.match(resource, policy.resource))
    ?.effect ?? fallback

export const Plugin = define({
  id: "opencode.config.policy",
  effect: Effect.fn(function* (ctx) {
    const config = yield* Config.Service
    const loaded = { entries: yield* config.entries() }
    const operator = yield* managed()

    // User-global policy takes priority over policy authored by a repository,
    // and operator-managed policy is appended last so it outranks both.
    const statements = () => [
      ...loaded.entries
        .filter((entry): entry is Document => entry.type === "document")
        .toReversed()
        .flatMap((entry) => entry.info.experimental?.policies ?? []),
      ...operator,
    ]

    /**
     * Integrations whose only providers were denied.
     *
     * Catalog and Integration are separate replayable states with independent
     * rebuild cycles, so this is a snapshot the catalog pass publishes for the
     * integration pass to read. It is rebuilt from scratch on every catalog pass
     * rather than accumulated: `State.materialize` replays transforms against a
     * fresh draft, so a set that only ever grew would keep denying an
     * integration whose provider had since come back.
     */
    let orphaned = new Set<string>()

    yield* ctx.catalog.transform((catalog) => {
      const policies = statements()
      const denied = new Set<string>()
      const kept = new Set<string>()
      for (const record of catalog.provider.list()) {
        // A provider's connection is usually named after the provider, but it
        // may authenticate through an integration named differently; both ids
        // belong to it.
        const connections = [
          record.provider.id,
          ...(record.provider.integrationID ? [record.provider.integrationID] : []),
        ]
        if (evaluate(policies, "provider.use", record.provider.id, "allow") === "deny") {
          catalog.provider.remove(record.provider.id)
          connections.forEach((id) => denied.add(id))
          continue
        }
        connections.forEach((id) => kept.add(id))
        for (const modelID of record.models.keys()) {
          if (evaluate(policies, "provider.model.use", `${record.provider.id}/${modelID}`, "allow") === "deny")
            catalog.model.remove(record.provider.id, modelID)
        }
      }
      // A provider that survives keeps its connection alive even when another
      // provider sharing that integration was denied.
      orphaned = new Set([...denied].filter((id) => !kept.has(id)))
    })

    // The "Connect provider" dialog lists integrations, not catalog providers,
    // so restricting the catalog alone would leave every provider connectable.
    // The default here is the decision already made for the provider that
    // authenticates through the integration: denying a provider stops offering
    // its connection without a second statement, while a pure tool connection
    // with no provider record stays available until denied explicitly.
    yield* ctx.integration.transform((integrations) => {
      const policies = statements()
      for (const integration of integrations.list()) {
        const fallback = orphaned.has(integration.id) ? "deny" : "allow"
        if (evaluate(policies, "integration.connect", integration.id, fallback) === "deny")
          integrations.remove(integration.id)
      }
    })

    yield* ctx.event.subscribe().pipe(
      Stream.filter((event) => event.type === "config.updated"),
      Stream.runForEach(() =>
        config.entries().pipe(
          Effect.tap((entries) => Effect.sync(() => (loaded.entries = entries))),
          Effect.andThen(ctx.catalog.reload()),
        ),
      ),
      Effect.forkScoped({ startImmediately: true }),
    )
  }),
})
