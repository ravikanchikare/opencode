import { describe, expect, setDefaultTimeout } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "path"
import { Duration, Effect, Layer, LayerMap } from "effect"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/util/effect/layer-node"
import { Global } from "@opencode-ai/util/global"
import { Bus } from "@opencode-ai/core/bus"
import { Command } from "@opencode-ai/core/command"
import { Database } from "@opencode-ai/core/database/database"
import { Watcher } from "@opencode-ai/core/filesystem/watcher"
import { Instance } from "@opencode-ai/core/instance"
import { LocationServiceMap } from "@opencode-ai/core/location-services"
import { Location } from "@opencode-ai/core/location"
import { ManagedPluginSource } from "@opencode-ai/core/plugin/managed-source"
import { Plugin } from "@opencode-ai/core/plugin"
import { SdkPlugins } from "@opencode-ai/core/plugin/sdk"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { tempGlobalLayer } from "../fixture/global"
import { offlineModels } from "../fixture/models"
import { testEffect } from "../lib/effect"

setDefaultTimeout(15_000)

const packaged = `export default {
  id: "acme.packaged",
  options: [{
    type: "multi-select",
    key: "domains",
    label: "Domains",
    description: "Selectable domains",
    choices: [
      { value: "alpha", label: "Alpha" },
      { value: "beta", label: "Beta" },
    ],
    default: ["alpha", "beta"],
  }],
  async setup(ctx) {
    const selected = Array.isArray(ctx.options.domains) ? ctx.options.domains : ["alpha", "beta"]
    await ctx.command.transform((editor) => {
      for (const domain of selected) editor.add({ name: "packaged-" + domain, execute: async () => {} })
    })
  },
}`

const packagedAt = (file: string) =>
  Layer.succeed(
    ManagedPluginSource.Service,
    ManagedPluginSource.Service.of({
      operations: () => Effect.succeed([{ type: "add" as const, target: file, options: {} }]),
    }),
  )

const harness = (file: string) => {
  const instances = Layer.effect(
    LocationServiceMap.Service,
    Effect.gen(function* () {
      const watcher = yield* Watcher.Test
      const map = yield* LayerMap.make((ref: Location.Ref) => Instance.layer(ref, { replacements: bindings }), {
        idleTimeToLive: Duration.infinity,
      })
      const bindings: LayerNode.Replacements = [
        Global.node.replace(tempGlobalLayer),
        offlineModels,
        Watcher.node.replace(Layer.succeed(Watcher.Service, watcher)),
        LocationServiceMap.node.replace(Layer.succeed(LocationServiceMap.Service, map)),
        ManagedPluginSource.node.replace(packagedAt(file)),
        Instance.node.replace(
          Layer.succeed(Instance.Service, {
            provide: (session) => Effect.provide(map.get(session.location)),
          }),
        ),
      ]
      return map
    }),
  ).pipe(Layer.provide(Watcher.testLayer))

  return AppNodeBuilder.build(
    LayerNode.group([Database.node, Bus.node, SdkPlugins.node, LocationServiceMap.node]),
    [Global.node.replace(tempGlobalLayer), offlineModels, LocationServiceMap.node.replace(instances)],
  ).pipe(Layer.provideMerge(Watcher.testLayer))
}

const workspace = (plugins: readonly unknown[] | undefined) => {
  const root = mkdtempSync(path.join(tmpdir(), "plugin-options-"))
  const file = path.join(root, "packaged", "acme.packaged.js")
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, packaged)
  if (plugins) {
    mkdirSync(path.join(root, ".opencode"), { recursive: true })
    writeFileSync(path.join(root, ".opencode/opencode.json"), JSON.stringify({ plugins }))
  }
  return { root, file }
}

describe("exact-ID plugin options", () => {
  const run = (
    name: string,
    plugins: readonly unknown[] | undefined,
    assert: (input: { readonly domains: readonly string[]; readonly inventory: readonly Plugin.Info[] }) => void,
  ) => {
    const { root, file } = workspace(plugins)
    testEffect(harness(file)).effect(name, () =>
      Effect.gen(function* () {
        const locations = yield* LocationServiceMap.Service
        yield* Effect.gen(function* () {
          const registry = yield* Plugin.Service
          const commands = yield* Command.Service
          yield* registry.awaitActivation
          const domains = [
            (yield* commands.get("packaged-alpha")) ? "alpha" : undefined,
            (yield* commands.get("packaged-beta")) ? "beta" : undefined,
          ].filter((item): item is string => item !== undefined)
          assert({ domains, inventory: yield* registry.list() })
        }).pipe(
          Effect.scoped,
          Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(root) }))),
        )
      }),
    )
  }

  run("loads packaged defaults when no ID override is present", undefined, ({ domains, inventory }) => {
    const matches = inventory.filter((plugin) => plugin.id === "acme.packaged")
    expect(matches).toHaveLength(1)
    expect(matches[0]?.options?.descriptors[0]?.key).toBe("domains")
    expect(domains).toEqual(["alpha", "beta"])
  })

  run(
    "applies exact-ID options to the single packaged instance",
    [{ package: "acme.packaged", options: { domains: ["beta"] } }],
    ({ domains, inventory }) => {
      expect(inventory.filter((plugin) => plugin.id === "acme.packaged")).toHaveLength(1)
      expect(domains).toEqual(["beta"])
    },
  )

  run("keeps string enable selectors from loading a second instance", ["acme.packaged"], ({ inventory }) => {
    expect(inventory.filter((plugin) => plugin.id === "acme.packaged")).toHaveLength(1)
  })

  run(
    "replaces arrays across later exact-ID entries",
    [
      { package: "acme.packaged", options: { domains: ["alpha"] } },
      { package: "acme.packaged", options: { domains: [] } },
    ],
    ({ domains }) => {
      expect(domains).toEqual([])
    },
  )

  run("ignores options on wildcard selectors", [{ package: "*", options: { domains: [] } }], ({ domains }) => {
    expect(domains).toEqual(["alpha", "beta"])
  })
})
