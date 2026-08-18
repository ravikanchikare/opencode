import { describe, expect } from "bun:test"
import { Document, Event, Info, type Entry } from "@opencode-ai/schema/config"
import { Catalog } from "@opencode-ai/core/catalog"
import { Config } from "@opencode-ai/core/config"
import { ConfigPolicyPlugin } from "@opencode-ai/core/config/plugin/policy"
import { Bus } from "@opencode-ai/core/bus"
import { Plugin } from "@opencode-ai/core/plugin"
import { PluginHost } from "@opencode-ai/core/plugin/host"
import { Integration } from "@opencode-ai/core/integration"
import { Model } from "@opencode-ai/core/model"
import { Provider } from "@opencode-ai/core/provider"
import { Effect, Schema, Stream } from "effect"
import { testEffect } from "../lib/effect"
import { PluginTestLayer } from "../plugin/fixture"

const it = testEffect(PluginTestLayer)
const decode = Schema.decodeUnknownSync(Info)

const policies = (...items: { action?: string; effect: "allow" | "deny"; resource: string }[]) =>
  new Document({
    type: "document",
    info: decode({
      experimental: {
        policies: items.map((item) => ({ action: "provider.use", ...item })),
      },
    }),
  })

const addPlugin = Effect.fn(function* (entries: Entry[]) {
  const plugin = yield* Plugin.Service
  const host = yield* PluginHost.make(plugin)
  yield* ConfigPolicyPlugin.Plugin.effect(host).pipe(Effect.provide(Config.testLayer(entries)))
})

function withManaged<A, E, R>(value: string | undefined, effect: () => Effect.Effect<A, E, R>) {
  return Effect.acquireUseRelease(
    Effect.sync(() => {
      const previous = process.env.OPENCODE_MANAGED_POLICY
      if (value === undefined) delete process.env.OPENCODE_MANAGED_POLICY
      else process.env.OPENCODE_MANAGED_POLICY = value
      return previous
    }),
    effect,
    (previous) =>
      Effect.sync(() => {
        if (previous === undefined) delete process.env.OPENCODE_MANAGED_POLICY
        else process.env.OPENCODE_MANAGED_POLICY = previous
      }),
  )
}

describe("ConfigPolicyPlugin.Plugin", () => {
  it.effect("filters plugin-provided providers with ordered wildcard policies", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      yield* catalog.transform((catalog) => {
        catalog.provider.update(Provider.ID.openai, () => {})
        catalog.provider.update(Provider.ID.anthropic, () => {})
        catalog.provider.update(Provider.ID.make("company-internal"), () => {})
      })
      yield* addPlugin([
        policies(
          { effect: "deny", resource: "*" },
          { effect: "allow", resource: "anthropic" },
          { effect: "allow", resource: "company-*" },
        ),
      ])

      expect(yield* catalog.provider.get(Provider.ID.openai)).toBeUndefined()
      expect(yield* catalog.provider.get(Provider.ID.anthropic)).toBeDefined()
      expect(yield* catalog.provider.get(Provider.ID.make("company-internal"))).toBeDefined()
    }),
  )

  it.effect("prevents project policy from overriding user-global policy", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      yield* catalog.transform((catalog) => catalog.provider.update(Provider.ID.openai, () => {}))
      yield* addPlugin([
        policies({ effect: "deny", resource: "openai" }),
        policies({ effect: "allow", resource: "openai" }),
      ])

      expect(yield* catalog.provider.get(Provider.ID.openai)).toBeUndefined()
    }),
  )

  it.effect("gives operator-managed policy the last word over authored policy", () =>
    withManaged(JSON.stringify([{ effect: "deny", action: "provider.use", resource: "openai" }]), () =>
      Effect.gen(function* () {
        // specs/v2/provider-policy.md: managed statements are appended after the
        // reversed authored statements, so neither a repository nor the user can
        // re-allow what the operator denied.
        const catalog = yield* Catalog.Service
        yield* catalog.transform((catalog) => catalog.provider.update(Provider.ID.openai, () => {}))
        yield* addPlugin([policies({ effect: "allow", resource: "openai" })])

        expect(yield* catalog.provider.get(Provider.ID.openai)).toBeUndefined()
      }),
    ),
  )

  it.effect("supports wildcard managed statements", () =>
    withManaged(
      JSON.stringify([
        { effect: "deny", action: "provider.use", resource: "*" },
        { effect: "allow", action: "provider.use", resource: "company-*" },
      ]),
      () =>
        Effect.gen(function* () {
          const catalog = yield* Catalog.Service
          yield* catalog.transform((catalog) => {
            catalog.provider.update(Provider.ID.openai, () => {})
            catalog.provider.update(Provider.ID.make("company-internal"), () => {})
          })
          yield* addPlugin([])

          expect(yield* catalog.provider.get(Provider.ID.openai)).toBeUndefined()
          expect(yield* catalog.provider.get(Provider.ID.make("company-internal"))).toBeDefined()
        }),
    ),
  )

  it.effect("ignores a malformed managed policy rather than denying everything", () =>
    withManaged("{not json", () =>
      Effect.gen(function* () {
        const catalog = yield* Catalog.Service
        yield* catalog.transform((catalog) => catalog.provider.update(Provider.ID.openai, () => {}))
        yield* addPlugin([])

        expect(yield* catalog.provider.get(Provider.ID.openai)).toBeDefined()
      }),
    ),
  )

  it.effect("denies models by provider/model resource", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      yield* catalog.transform((catalog) => {
        catalog.provider.update(Provider.ID.anthropic, () => {})
        catalog.model.update(Provider.ID.anthropic, Model.ID.make("keep"), () => {})
        catalog.model.update(Provider.ID.anthropic, Model.ID.make("drop"), () => {})
      })
      yield* addPlugin([
        policies(
          { action: "provider.model.use", effect: "deny", resource: "anthropic/*" },
          { action: "provider.model.use", effect: "allow", resource: "anthropic/keep" },
        ),
      ])

      expect((yield* catalog.model.all()).map((model) => model.id)).toEqual([Model.ID.make("keep")])
      expect(yield* catalog.provider.get(Provider.ID.anthropic)).toBeDefined()
    }),
  )

  it.effect("stops offering the connection of a denied provider", () =>
    Effect.gen(function* () {
      // The Connect dialog reads integration.list, not the catalog, so denying
      // a provider has to reach it — without a second statement.
      const catalog = yield* Catalog.Service
      const integration = yield* Integration.Service
      yield* catalog.transform((catalog) => {
        catalog.provider.update(Provider.ID.openai, () => {})
        catalog.provider.update(Provider.ID.anthropic, () => {})
      })
      yield* integration.transform((editor) => {
        editor.update(Integration.ID.make("openai"), () => {})
        editor.update(Integration.ID.make("anthropic"), () => {})
      })
      yield* addPlugin([policies({ effect: "deny", resource: "openai" })])

      expect((yield* integration.list()).map((entry) => entry.id)).toEqual([Integration.ID.make("anthropic")])
    }),
  )

  it.effect("keeps a connection that no provider record backs", () =>
    Effect.gen(function* () {
      // A pure tool connection has no catalog entry, so nothing denies it by
      // implication; only an explicit statement can.
      const catalog = yield* Catalog.Service
      const integration = yield* Integration.Service
      yield* catalog.transform((catalog) => catalog.provider.update(Provider.ID.openai, () => {}))
      yield* integration.transform((editor) => {
        editor.update(Integration.ID.make("openai"), () => {})
        editor.update(Integration.ID.make("devrev"), () => {})
      })
      yield* addPlugin([policies({ effect: "deny", resource: "*" })])

      expect((yield* integration.list()).map((entry) => entry.id)).toEqual([Integration.ID.make("devrev")])
    }),
  )

  it.effect("lets an explicit connect statement override the provider default", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const integration = yield* Integration.Service
      yield* catalog.transform((catalog) => catalog.provider.update(Provider.ID.openai, () => {}))
      yield* integration.transform((editor) => editor.update(Integration.ID.make("openai"), () => {}))
      yield* addPlugin([
        policies(
          { effect: "deny", resource: "openai" },
          { action: "integration.connect", effect: "allow", resource: "openai" },
        ),
      ])

      expect(yield* catalog.provider.get(Provider.ID.openai)).toBeUndefined()
      expect((yield* integration.list()).map((entry) => entry.id)).toEqual([Integration.ID.make("openai")])
    }),
  )

  it.live("reloads changed policies", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const bus = yield* Bus.Service
      const test = yield* Config.Test
      const plugin = yield* Plugin.Service
      const host = yield* PluginHost.make(plugin)
      yield* catalog.transform((catalog) => catalog.provider.update(Provider.ID.openai, () => {}))
      yield* ConfigPolicyPlugin.Plugin.effect(host)
      expect(yield* catalog.provider.get(Provider.ID.openai)).toBeUndefined()

      yield* test.setEntries([policies({ effect: "allow", resource: "openai" })])
      yield* bus.publish(Event.Updated, {})
      yield* waitUntil(catalog.provider.get(Provider.ID.openai).pipe(Effect.map((provider) => provider !== undefined)))
    }).pipe(Effect.provide(Config.testLayer([policies({ effect: "deny", resource: "openai" })]))),
  )
})

const waitUntil = Effect.fnUntraced(function* (condition: Effect.Effect<boolean>) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (yield* condition) return
    yield* Effect.sleep("10 millis")
  }
  return yield* Effect.die("Timed out waiting for policy reload")
})
