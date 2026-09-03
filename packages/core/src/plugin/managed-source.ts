export * as ManagedPluginSource from "./managed-source.js"

import { makeLocationNode } from "@opencode-ai/util/effect/app-node"
import { Context, Effect, Layer, Schema } from "effect"
import path from "path"
import type { ConfigPluginSource } from "../config/plugin/source.js"

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
