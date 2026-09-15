export * as ExtensionEnablement from "./extension-enablement.js"

import { createHash } from "node:crypto"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { Context, Effect, Layer } from "effect"
import { KV } from "./kv.js"
import { Location } from "./location.js"

export type Kind = "plugin" | "skill"

export interface State {
  readonly enabled: boolean
  readonly inherited: boolean
  readonly defaultEnabled: boolean
}

export interface Interface {
  readonly isEnabled: (kind: Kind, id: string) => Effect.Effect<boolean>
  readonly state: (kind: Kind, id: string, scope?: "location" | "default") => Effect.Effect<State>
  readonly setDefault: (kind: Kind, id: string, enabled: boolean) => Effect.Effect<void>
  readonly setOverride: (kind: Kind, id: string, enabled?: boolean) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ExtensionEnablement") {}

const digest = (value: string) => createHash("sha256").update(value).digest("hex")

/**
 * Availability is opt-out: only `false` is ever stored, so an empty KV is a
 * working install rather than a silent one. The Location dimension lives in the
 * key because the store is global; the directory is hashed so key length stays
 * fixed and an absolute path from a developer's machine never becomes a row.
 *
 * Changes are announced by `Skill.setEnabled` publishing `skill.updated`, which
 * the event manifest streams to clients. This domain deliberately emits nothing
 * of its own: an earlier `extension.enablement.updated` event was published on
 * the default path, skipped on the override path, and absent from
 * `EventManifest` either way, so it reached no subscriber at all.
 */
export function make(kv: KV.Interface, directory: string): Interface {
  const prefix = digest(directory)
  const defaultKey = (kind: Kind, id: string) => `extension/${kind}/default/${digest(id)}`
  const overrideKey = (kind: Kind, id: string) => `extension/${kind}/${prefix}/${digest(id)}`
  const defaultEnabled = Effect.fn("ExtensionEnablement.defaultEnabled")(function* (kind: Kind, id: string) {
    return (yield* kv.get(defaultKey(kind, id))) !== false
  })
  const state = Effect.fn("ExtensionEnablement.state")(function* (
    kind: Kind,
    id: string,
    scope: "location" | "default" = "location",
  ) {
    const fallback = yield* defaultEnabled(kind, id)
    if (scope === "default") return { enabled: fallback, inherited: false, defaultEnabled: fallback }
    const override = yield* kv.get(overrideKey(kind, id))
    if (typeof override !== "boolean") return { enabled: fallback, inherited: true, defaultEnabled: fallback }
    return { enabled: override, inherited: false, defaultEnabled: fallback }
  })
  return Service.of({
    isEnabled: Effect.fn("ExtensionEnablement.isEnabled")(function* (kind, id) {
      return (yield* state(kind, id)).enabled
    }),
    state,
    setDefault: Effect.fn("ExtensionEnablement.setDefault")(function* (kind, id, enabled) {
      if (enabled) yield* kv.remove(defaultKey(kind, id))
      else yield* kv.set(defaultKey(kind, id), false)
    }),
    setOverride: Effect.fn("ExtensionEnablement.setOverride")(function* (kind, id, enabled) {
      if (enabled === undefined) {
        yield* kv.remove(overrideKey(kind, id))
        return
      }
      yield* kv.set(overrideKey(kind, id), enabled)
    }),
  })
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const kv = yield* KV.Service
    const location = yield* Location.Service
    return make(kv, location.directory)
  }),
)

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [KV.node, Location.node],
})
