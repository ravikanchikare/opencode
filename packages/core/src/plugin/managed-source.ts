export * as ManagedPluginSource from "./managed-source.js"

import { makeLocationNode } from "@opencode-ai/util/effect/app-node"
import { Context, Effect, Layer, Schema } from "effect"
import path from "path"
import type { ConfigPluginSource } from "../config/plugin/source.js"

/**
 * Absolute plugin paths a packaged distribution delivers with the application.
 *
 * The packager is responsible for whatever verification it wants to do before
 * naming these — the desktop app checks a manifest and a SHA-256 per file — but
 * that all happens before this point. What arrives here is a list of paths, and
 * what leaves is ordinary `add` operations: they are placed ahead of anything
 * the user configured so authored configuration is applied last and wins, and
 * from there they load, are classified, and are selected exactly like any other
 * plugin. Nothing downstream can tell where they came from, and nothing should:
 * an authored `-<id>` or `-*` removes one, and its inventory entry reports the
 * `local` source that its absolute path earns it.
 */
const Entries = Schema.Array(Schema.String)
const decode = Schema.decodeUnknownEffect(Schema.fromJsonString(Entries))

export type Operation = Extract<ConfigPluginSource.Operation, { type: "add" }>

export interface Interface {
  readonly operations: () => Effect.Effect<readonly Operation[], Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ManagedPluginSource") {}

export function operations(env: Record<string, string | undefined> = process.env) {
  const raw = env.OPENCODE_MANAGED_PLUGINS
  if (!raw) return Effect.succeed([])
  return decode(raw).pipe(
    Effect.mapError((error) => new Error(`Invalid OPENCODE_MANAGED_PLUGINS: ${error.message}`)),
    Effect.flatMap((entries) => {
      const invalid = entries.find((entry) => !path.isAbsolute(entry))
      if (invalid) return Effect.fail(new Error(`Managed plugin path must be absolute: ${invalid}`))
      if (new Set(entries).size !== entries.length)
        return Effect.fail(new Error("OPENCODE_MANAGED_PLUGINS contains duplicate paths"))
      return Effect.succeed(
        entries.map(
          (target): Operation => ({
            type: "add",
            target,
            options: {},
          }),
        ),
      )
    }),
  )
}

export const layer = Layer.succeed(Service, Service.of({ operations }))
export const node = makeLocationNode({ service: Service, layer, deps: [] })

export const empty = makeLocationNode({
  service: Service,
  layer: Layer.succeed(Service, Service.of({ operations: () => Effect.succeed([]) })),
  deps: [],
})
