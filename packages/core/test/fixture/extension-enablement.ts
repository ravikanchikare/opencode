import { ExtensionEnablement } from "@opencode-ai/core/extension-enablement"
import { makeLocationNode } from "@opencode-ai/util/effect/app-node"
import { Effect, Layer } from "effect"

export function extensionEnablementNode(disabled = new Set<string>()) {
  const defaults = new Map<string, boolean>()
  const overrides = new Map<string, boolean>()
  const key = (kind: ExtensionEnablement.Kind, id: string) => `${kind}:${id}`
  const state = (kind: ExtensionEnablement.Kind, id: string, scope: "location" | "default" = "location") => {
    const defaultEnabled = defaults.get(key(kind, id)) ?? !disabled.has(id)
    const override = overrides.get(key(kind, id))
    if (scope === "default") return { enabled: defaultEnabled, inherited: false, defaultEnabled }
    if (override === undefined) return { enabled: defaultEnabled, inherited: true, defaultEnabled }
    return { enabled: override, inherited: false, defaultEnabled }
  }
  return makeLocationNode({
    service: ExtensionEnablement.Service,
    layer: Layer.succeed(
      ExtensionEnablement.Service,
      ExtensionEnablement.Service.of({
        isEnabled: (kind, id) => Effect.succeed(state(kind, id).enabled),
        state: (kind, id, scope) => Effect.succeed(state(kind, id, scope)),
        setDefault: (kind, id, enabled) =>
          Effect.sync(() => {
            defaults.set(key(kind, id), enabled)
          }),
        setOverride: (kind, id, enabled) =>
          Effect.sync(() => {
            if (enabled === undefined) overrides.delete(key(kind, id))
            else overrides.set(key(kind, id), enabled)
          }),
      }),
    ),
    deps: [],
  })
}
