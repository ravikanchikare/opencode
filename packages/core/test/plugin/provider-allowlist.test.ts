import { describe, expect } from "bun:test"
import { Effect, Fiber, Layer } from "effect"
import { TestClock } from "effect/testing"
import { Bus } from "@opencode-ai/core/bus"
import { Catalog } from "@opencode-ai/core/catalog"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { Integration } from "@opencode-ai/core/integration"
import { Location } from "@opencode-ai/core/location"
import { Model } from "@opencode-ai/core/model"
import { ProviderAllowlistPlugin } from "@opencode-ai/core/plugin/provider-allowlist"
import { Provider } from "@opencode-ai/core/provider"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { LayerNode } from "@opencode-ai/util/effect/layer-node"
import { location } from "../fixture/location"
import { testEffect } from "../lib/effect"
import { catalogHost, host, integrationHost } from "./host"

const locationLayer = Layer.succeed(
  Location.Service,
  Location.Service.of(location({ directory: AbsolutePath.make(import.meta.dir) })),
)
const layer = AppNodeBuilder.build(LayerNode.group([Catalog.node, Integration.node, Bus.node]), [
  [Location.node, locationLayer],
])
const it = testEffect(layer)

function populate(catalog: Catalog.Interface) {
  return catalog.transform((editor) => {
    editor.provider.update(Provider.ID.make("acme"), () => {})
    editor.provider.update(Provider.ID.make("openai"), () => {})
    editor.model.update(Provider.ID.make("acme"), Model.ID.make("keep"), () => {})
    editor.model.update(Provider.ID.make("acme"), Model.ID.make("drop"), () => {})
  })
}

function withEnv<A, E, R>(variables: Record<string, string | undefined>, effect: () => Effect.Effect<A, E, R>) {
  return Effect.acquireUseRelease(
    Effect.sync(() => {
      const previous = Object.fromEntries(Object.keys(variables).map((key) => [key, process.env[key]]))
      Object.entries(variables).forEach(([key, value]) => {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      })
      return previous
    }),
    effect,
    (previous) =>
      Effect.sync(() => {
        Object.entries(previous).forEach(([key, value]) => {
          if (value === undefined) delete process.env[key]
          else process.env[key] = value
        })
      }),
  )
}

function populateIntegrations(integration: Integration.Interface) {
  return integration.transform((editor) => {
    editor.update(Integration.ID.make("acme"), () => {})
    editor.update(Integration.ID.make("openai"), () => {})
  })
}

/** The plugin governs both domains, so every invocation needs both hosts. */
function pluginHost(catalog: Catalog.Interface, integration: Integration.Interface) {
  return host({ catalog: catalogHost(catalog), integration: integrationHost(integration) })
}

function applyAllowlist(catalog: Catalog.Interface, integration: Integration.Interface) {
  return withEnv(
    {
      OPENCODE_PROVIDER_ALLOWLIST: JSON.stringify({
        providers: ["acme"],
        models: { acme: ["keep"] },
      }),
    },
    () => ProviderAllowlistPlugin.Plugin.effect(pluginHost(catalog, integration)),
  )
}

describe("ProviderAllowlistPlugin", () => {
  it.effect("removes providers and models outside the allowlist", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const integration = yield* Integration.Service
      yield* populate(catalog)
      yield* applyAllowlist(catalog, integration)

      expect((yield* catalog.provider.all()).map((provider) => provider.id)).toEqual([Provider.ID.make("acme")])
      expect((yield* catalog.model.all()).map((model) => model.id)).toEqual([Model.ID.make("keep")])
    }),
  )

  it.effect("keeps the catalog unchanged when the allowlist env is unset", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      yield* populate(catalog)

      const integration = yield* Integration.Service
      yield* withEnv({ OPENCODE_PROVIDER_ALLOWLIST: undefined }, () =>
        ProviderAllowlistPlugin.Plugin.effect(pluginHost(catalog, integration)),
      )

      expect((yield* catalog.provider.all()).length).toBe(2)
      expect((yield* catalog.model.all()).length).toBe(2)
    }),
  )

  it.effect("keeps the catalog unchanged for a malformed allowlist", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      yield* populate(catalog)

      const integration = yield* Integration.Service
      yield* withEnv({ OPENCODE_PROVIDER_ALLOWLIST: "{not json" }, () =>
        ProviderAllowlistPlugin.Plugin.effect(pluginHost(catalog, integration)),
      )

      expect((yield* catalog.provider.all()).length).toBe(2)
      expect((yield* catalog.model.all()).length).toBe(2)
    }),
  )

  it.effect("re-applies removal when the catalog is reloaded", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const integration = yield* Integration.Service
      yield* populate(catalog)
      yield* applyAllowlist(catalog, integration)
      expect((yield* catalog.provider.all()).length).toBe(1)

      yield* withEnv({ OPENCODE_PROVIDER_ALLOWLIST: JSON.stringify({ providers: ["acme"] }) }, () =>
        Effect.gen(function* () {
          const reload = yield* catalog.reload().pipe(Effect.forkChild({ startImmediately: true }))
          yield* TestClock.adjust("500 millis")
          yield* Fiber.join(reload)
        }),
      )

      expect((yield* catalog.provider.all()).length).toBe(1)
      expect((yield* catalog.model.all()).map((model) => model.id)).toEqual([Model.ID.make("keep")])
    }),
  )

  it.effect("removes integrations outside the allowlist", () =>
    Effect.gen(function* () {
      // The "Connect provider" dialog lists integrations, not catalog
      // providers. Restricting only the catalog leaves every provider
      // connectable, which is not what an operator setting an allowlist means.
      const catalog = yield* Catalog.Service
      const integration = yield* Integration.Service
      yield* populate(catalog)
      yield* populateIntegrations(integration)

      expect((yield* integration.list()).map((entry) => entry.id)).toContain(Integration.ID.make("openai"))

      yield* applyAllowlist(catalog, integration)

      expect((yield* integration.list()).map((entry) => entry.id)).toEqual([Integration.ID.make("acme")])
    }),
  )

  it.effect("leaves integrations alone when the allowlist env is unset", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const integration = yield* Integration.Service
      yield* populate(catalog)
      yield* populateIntegrations(integration)

      yield* withEnv({ OPENCODE_PROVIDER_ALLOWLIST: undefined }, () =>
        ProviderAllowlistPlugin.Plugin.effect(pluginHost(catalog, integration)),
      )

      expect((yield* integration.list()).length).toBe(2)
    }),
  )
})