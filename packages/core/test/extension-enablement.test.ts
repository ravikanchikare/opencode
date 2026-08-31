import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { ExtensionEnablement } from "@opencode-ai/core/extension-enablement"
import { KV } from "@opencode-ai/core/kv"
import { LayerNode } from "@opencode-ai/util/effect/layer-node"
import { testEffect } from "./lib/effect"

const it = testEffect(LayerNode.compile(KV.node))

describe("ExtensionEnablement", () => {
  it.effect("inherits an enabled global default", () =>
    Effect.gen(function* () {
      const kv = yield* KV.Service
      const service = ExtensionEnablement.make(kv, "/project")

      expect(yield* service.isEnabled("plugin", "example")).toBe(true)
      expect(yield* service.state("plugin", "example")).toEqual({
        enabled: true,
        inherited: true,
        defaultEnabled: true,
      })
      expect((yield* kv.scan({ prefix: "extension/" })).entries).toEqual([])
    }),
  )

  it.effect("applies global defaults unless a Location overrides them", () =>
    Effect.gen(function* () {
      const kv = yield* KV.Service
      const first = ExtensionEnablement.make(kv, "/project-a")
      const second = ExtensionEnablement.make(kv, "/project-b")

      yield* first.setDefault("plugin", "shared", false)
      expect(yield* first.isEnabled("plugin", "shared")).toBe(false)
      expect(yield* second.isEnabled("plugin", "shared")).toBe(false)

      yield* first.setOverride("plugin", "shared", true)
      expect(yield* first.isEnabled("plugin", "shared")).toBe(true)
      expect(yield* first.state("plugin", "shared")).toEqual({
        enabled: true,
        inherited: false,
        defaultEnabled: false,
      })
      expect(yield* second.isEnabled("plugin", "shared")).toBe(false)

      yield* first.setOverride("plugin", "shared")
      expect(yield* first.isEnabled("plugin", "shared")).toBe(false)
      expect((yield* first.state("plugin", "shared")).inherited).toBe(true)
    }),
  )

  it.effect("isolates kinds and Location overrides", () =>
    Effect.gen(function* () {
      const kv = yield* KV.Service
      const first = ExtensionEnablement.make(kv, "/project-a")
      const second = ExtensionEnablement.make(kv, "/project-b")

      yield* first.setOverride("plugin", "shared", false)
      yield* first.setOverride("skill", "shared", false)

      expect(yield* first.isEnabled("plugin", "shared")).toBe(false)
      expect(yield* first.isEnabled("skill", "shared")).toBe(false)
      expect(yield* second.isEnabled("plugin", "shared")).toBe(true)
      expect(yield* first.isEnabled("plugin", "other")).toBe(true)
    }),
  )
})
