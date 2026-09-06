import { describe, expect, setDefaultTimeout } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "path"
import { Duration, Effect, Layer, LayerMap } from "effect"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Global } from "@opencode/util/global"
import { Bus } from "@opencode/core/bus"
import { Command } from "@opencode/core/command"
import { Database } from "@opencode/core/database/database"
import { Watcher } from "@opencode/core/filesystem/watcher"
import { Instance } from "@opencode/core/instance"
import { LocationServiceMap } from "@opencode/core/location-services"
import { Location } from "@opencode/core/location"
import { ManagedPluginSource } from "@opencode/core/plugin/managed-source"
import { Plugin } from "@opencode/core/plugin"
import { SdkPlugins } from "@opencode/core/plugin/sdk"
import { AbsolutePath } from "@opencode/core/schema"
import { tempGlobalLayer } from "../fixture/global"
import { offlineModels } from "../fixture/models"
import { testEffect } from "../lib/effect"

/**
 * A packaged distribution hands the host verified absolute paths, which reach
 * `ConfigPluginSource` ahead of anything the user configured. That is the whole
 * of the mechanism: the paths become ordinary `add` operations and then follow
 * the same loading, classification, and selector rules as any other plugin.
 *
 * `Plugin.Source` briefly carried a `managed` variant implying otherwise. No
 * loading path ever produced it — an absolute target is classified `local` — so
 * the schema advertised a provenance the runtime could not report and the
 * published OpenAPI document never contained. These tests pin the two claims
 * that replace it, so the schema and the classifier cannot drift apart again.
 */
setDefaultTimeout(15_000)

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

const packaged = `export default {
  id: "acme.packaged",
  async setup(ctx) {
    await ctx.command.transform((editor) => editor.add({ name: "packaged-greet", execute: async () => {} }))
  },
}`

/**
 * The packaged path has to exist before the layer is built, because the layer
 * is what carries it. An earlier version of this file assigned it inside the
 * effect body, so every run delivered an empty path, nothing loaded, and the
 * two removal cases passed for the wrong reason.
 */
const workspace = (plugins: readonly string[] | undefined) => {
  const root = mkdtempSync(path.join(tmpdir(), "packaged-plugin-"))
  const file = path.join(root, "packaged", "acme.packaged.js")
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, packaged)
  if (plugins) {
    mkdirSync(path.join(root, ".opencode"), { recursive: true })
    writeFileSync(path.join(root, ".opencode/opencode.json"), JSON.stringify({ plugins }))
  }
  return { root, file }
}

const scenario = (
  name: string,
  plugins: readonly string[] | undefined,
  assert: (input: { readonly command: unknown; readonly inventory: readonly Plugin.Info[] }) => void,
) => {
  const { root, file } = workspace(plugins)
  testEffect(harness(file)).effect(name, () =>
    Effect.gen(function* () {
      const locations = yield* LocationServiceMap.Service
      yield* Effect.gen(function* () {
        const registry = yield* Plugin.Service
        const commands = yield* Command.Service
        yield* registry.awaitActivation
        assert({ command: yield* commands.get("packaged-greet"), inventory: yield* registry.list() })
      }).pipe(
        Effect.scoped,
        Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(root) }))),
      )
    }),
  )
}

describe("a packaged plugin path", () => {
  scenario("loads and reports itself as an ordinary local plugin", undefined, ({ command, inventory }) => {
    expect(command).toBeDefined()
    const entry = inventory.find((plugin) => plugin.id === "acme.packaged")
    expect(entry).toBeDefined()
    // Not "managed": an absolute target is a local plugin, which is what the
    // published schema and the OpenAPI document both say.
    expect(entry?.source.type).toBe("local")
  })

  scenario("is removed by an authored remove selector naming its id", ["-acme.packaged"], ({ command, inventory }) => {
    expect(command).toBeUndefined()
    expect(inventory.find((plugin) => plugin.id === "acme.packaged")).toBeUndefined()
  })

  scenario("is removed by a wildcard remove selector", ["-*"], ({ command, inventory }) => {
    expect(command).toBeUndefined()
    expect(inventory.find((plugin) => plugin.id === "acme.packaged")).toBeUndefined()
  })
})
