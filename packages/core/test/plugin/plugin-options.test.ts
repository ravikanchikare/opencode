import { describe, expect, setDefaultTimeout } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "path"
import { Duration, Effect, Layer, LayerMap, Schedule } from "effect"
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
import { PluginOptionConfig } from "@opencode-ai/core/plugin/option-config"
import { SdkPlugins } from "@opencode-ai/core/plugin/sdk"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { tempGlobalLayer } from "../fixture/global"
import { offlineModels } from "../fixture/models"
import { testEffect } from "../lib/effect"

setDefaultTimeout(15_000)

const packaged = `export default {
  id: "acme.packaged",
  name: "Acme API",
  description: "Acme tools by domain.",
  options: [{
    type: "multi-select",
    key: "domains",
    label: "Domains",
    description: "Selectable domains",
    choices: [
      { value: "alpha", label: "Alpha", tools: [{
        name: "alpha.list", description: "List alpha records", input: { type: "object" }
      }] },
      { value: "beta", label: "Beta" },
    ],
    default: ["alpha", "beta"],
  }],
  async setup(ctx) {
    const selected = Array.isArray(ctx.options.domains) ? ctx.options.domains : ["alpha", "beta"]
    if (selected.includes("fail")) throw new Error("unavailable domain: fail")
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

  return AppNodeBuilder.build(LayerNode.group([Database.node, Bus.node, SdkPlugins.node, LocationServiceMap.node]), [
    Global.node.replace(tempGlobalLayer),
    offlineModels,
    LocationServiceMap.node.replace(instances),
  ]).pipe(Layer.provideMerge(Watcher.testLayer))
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
        }).pipe(Effect.scoped, Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(root) }))))
      }),
    )
  }

  run("loads packaged defaults when no ID override is present", undefined, ({ domains, inventory }) => {
    const matches = inventory.filter((plugin) => plugin.id === "acme.packaged")
    expect(matches).toHaveLength(1)
    expect(matches[0]?.name).toBe("Acme API")
    expect(matches[0]?.description).toBe("Acme tools by domain.")
    expect(matches[0]?.options?.descriptors[0]?.key).toBe("domains")
    expect(domains).toEqual(["alpha", "beta"])
  })

  run(
    "applies exact-ID options to the single packaged instance",
    [{ package: "acme.packaged", options: { domains: ["beta"] } }],
    ({ domains, inventory }) => {
      expect(inventory.filter((plugin) => plugin.id === "acme.packaged")).toHaveLength(1)
      expect(
        inventory.find((plugin) => plugin.id === "acme.packaged")?.options?.descriptors[0]?.choices[0]?.tools,
      ).toEqual([{ name: "alpha.list", description: "List alpha records", input: { type: "object" } }])
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

  run(
    "does not register tools when option activation fails",
    [{ package: "acme.packaged", options: { domains: ["fail"] } }],
    ({ domains, inventory }) => {
      const entry = inventory.find((plugin) => plugin.id === "acme.packaged")
      expect(entry?.state.status).toBe("failed")
      expect(String(entry?.state.status === "failed" ? entry.state.error : "")).toContain("unavailable domain: fail")
      expect(domains).toEqual([])
      expect(entry?.options?.effective).toEqual({ domains: ["fail"] })
    },
  )
})

const domainsOf = (commands: Command.Interface) =>
  Effect.gen(function* () {
    return [
      (yield* commands.get("packaged-alpha")) ? "alpha" : undefined,
      (yield* commands.get("packaged-beta")) ? "beta" : undefined,
    ].filter((item): item is string => item !== undefined)
  })

const waitFor = (check: Effect.Effect<boolean>, message: string) =>
  check.pipe(
    Effect.flatMap((ready) => (ready ? Effect.void : Effect.fail(message))),
    Effect.retry({ times: 80, schedule: Schedule.spaced("25 millis") }),
  )

const writePlugins = (root: string, plugins: readonly unknown[]) => {
  const file = path.join(root, ".opencode/opencode.json")
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify({ plugins }))
  return file
}

describe("exact-ID plugin option reloads", () => {
  const reload = (
    name: string,
    initial: readonly unknown[],
    next: readonly unknown[],
    assert: (input: {
      readonly before: readonly string[]
      readonly after: readonly string[]
      readonly inventory: readonly Plugin.Info[]
    }) => void,
  ) => {
    const { root, file } = workspace(initial)
    testEffect(harness(file)).live(name, () =>
      Effect.gen(function* () {
        const watcher = yield* Watcher.Test
        const locations = yield* LocationServiceMap.Service
        yield* Effect.gen(function* () {
          const registry = yield* Plugin.Service
          const commands = yield* Command.Service
          yield* registry.awaitActivation
          const before = yield* domainsOf(commands)
          const config = writePlugins(root, next)
          yield* watcher.emit({ path: config, type: "update" })
          yield* waitFor(
            domainsOf(commands).pipe(Effect.map((domains) => JSON.stringify(domains) !== JSON.stringify(before))),
            "options reload pending",
          )
          assert({ before, after: yield* domainsOf(commands), inventory: yield* registry.list() })
        }).pipe(Effect.scoped, Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(root) }))))
      }),
    )
  }

  reload(
    "removes an exact-ID override and restores inherited defaults",
    [{ package: "acme.packaged", options: { domains: ["beta"] } }],
    [],
    ({ before, after }) => {
      expect(before).toEqual(["beta"])
      expect(after).toEqual(["alpha", "beta"])
    },
  )

  reload(
    "rebuilds contributions when only options change",
    [],
    [{ package: "acme.packaged", options: { domains: ["beta"] } }],
    ({ before, after, inventory }) => {
      expect(before).toEqual(["alpha", "beta"])
      expect(after).toEqual(["beta"])
      expect(inventory.filter((plugin) => plugin.id === "acme.packaged")).toHaveLength(1)
    },
  )
})

describe("PluginOptionConfig on the instance graph", () => {
  const { root, file } = workspace(undefined)
  testEffect(harness(file)).effect("exposes option views to location-scoped HTTP handlers", () =>
    Effect.gen(function* () {
      const locations = yield* LocationServiceMap.Service
      const viewed = yield* Effect.gen(function* () {
        const options = yield* PluginOptionConfig.Service
        const plugins = yield* Plugin.Service
        yield* plugins.awaitActivation
        const current = (yield* plugins.list()).find((plugin) => plugin.id === "acme.packaged")
        if (!current) throw new Error("missing packaged plugin")
        return yield* options.view(current, "location")
      }).pipe(Effect.scoped, Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(root) }))))
      expect(viewed.options?.inherited).toBe(true)
      expect(viewed.options?.descriptors[0]?.key).toBe("domains")
    }),
  )
})
