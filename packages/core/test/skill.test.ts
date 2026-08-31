import { describe, expect } from "bun:test"
import { Deferred, Effect, Fiber, Stream } from "effect"
import { Agent } from "@opencode-ai/core/agent"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/util/effect/layer-node"
import { Bus } from "@opencode-ai/core/bus"
import { ExtensionEnablement } from "@opencode-ai/core/extension-enablement"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { Skill } from "@opencode-ai/core/skill"
import { extensionEnablementNode } from "./fixture/extension-enablement"
import { testEffect } from "./lib/effect"

const it = testEffect(
  AppNodeBuilder.build(LayerNode.group([Skill.node, Agent.node, Bus.node]), [
    ExtensionEnablement.node.replace(extensionEnablementNode()),
  ]),
)

const info = (id: string, description: string) =>
  Skill.Info.make({
    id: Skill.ID.make(id),
    name: Skill.Name.make(id),
    description,
    location: AbsolutePath.make(`/skills/${id}/SKILL.md`),
    content: `# ${id}`,
  })

describe("Skill", () => {
  it.effect("registers values with last-write-wins precedence", () =>
    Effect.gen(function* () {
      const skill = yield* Skill.Service
      yield* skill.transform((draft) => {
        draft.add(info("review", "First"))
        draft.add(info("deploy", "Deploy"))
        draft.add(info("review", "Second"))
        expect(draft.list().map((item) => item.id)).toEqual([Skill.ID.make("review"), Skill.ID.make("deploy")])
      })

      expect(yield* skill.list()).toEqual([info("review", "Second"), info("deploy", "Deploy")])
      expect(yield* skill.get(Skill.ID.make("review"))).toEqual(info("review", "Second"))
      expect(yield* skill.get(Skill.ID.make("missing"))).toBeUndefined()
    }),
  )

  it.effect("updates and removes registered values", () =>
    Effect.gen(function* () {
      const skill = yield* Skill.Service
      yield* skill.transform((draft) => {
        draft.add(info("review", "Initial"))
        draft.update("review", (value) => {
          value.description = "Updated"
          value.id = Skill.ID.make("ignored")
        })
        draft.update("missing", () => {
          throw new Error("unreachable")
        })
        draft.add(info("deploy", "Deploy"))
        draft.remove("deploy")
      })

      expect(yield* skill.list()).toEqual([info("review", "Updated")])
    }),
  )

  it.effect("keeps disabled skills in inventory while filtering effective lookups", () =>
    Effect.gen(function* () {
      const skill = yield* Skill.Service
      yield* skill.transform((draft) => {
        draft.add(info("review", "Review"))
        draft.add(info("deploy", "Deploy"))
      })

      expect(yield* skill.setEnabled(Skill.ID.make("review"), false)).toBe(true)
      expect(yield* skill.setEnabled(Skill.ID.make("missing"), false)).toBe(false)
      expect(yield* skill.inventory()).toEqual([
        { ...info("review", "Review"), enabled: false, inherited: false, defaultEnabled: true },
        { ...info("deploy", "Deploy"), enabled: true, inherited: true, defaultEnabled: true },
      ])
      expect(yield* skill.list()).toEqual([info("deploy", "Deploy")])
      expect(yield* skill.get(Skill.ID.make("review"))).toBeUndefined()

      expect(yield* skill.setEnabled(Skill.ID.make("review"), true)).toBe(true)
      expect(yield* skill.get(Skill.ID.make("review"))).toEqual(info("review", "Review"))
    }),
  )

  it.effect("retains enablement across candidate replacement and scopes it by ID", () =>
    Effect.gen(function* () {
      const skill = yield* Skill.Service
      const first = info("first", "Shared name")
      const second = { ...info("second", "Shared name"), name: first.name }
      const registration = yield* skill.transform((draft) => {
        draft.add(first)
        draft.add(second)
      })
      yield* skill.setEnabled(first.id, false)

      yield* registration.dispose
      yield* skill.transform((draft) => {
        draft.add({ ...first, description: "Replaced" })
        draft.add(second)
      })

      expect(yield* skill.inventory()).toEqual([
        { ...first, description: "Replaced", enabled: false, inherited: false, defaultEnabled: true },
        { ...second, enabled: true, inherited: true, defaultEnabled: true },
      ])
      expect(yield* skill.list()).toEqual([second])
    }),
  )

  it.effect("inherits the global default until the Location overrides or restores it", () =>
    Effect.gen(function* () {
      const skill = yield* Skill.Service
      const review = info("inherited-review", "Review")
      yield* skill.transform((draft) => draft.add(review))

      expect(yield* skill.setEnabled(review.id, false, "default")).toBe(true)
      expect(yield* skill.get(review.id)).toBeUndefined()
      expect(yield* skill.inventory()).toEqual([{ ...review, enabled: false, inherited: true, defaultEnabled: false }])

      expect(yield* skill.setEnabled(review.id, true)).toBe(true)
      expect(yield* skill.get(review.id)).toEqual(review)
      expect(yield* skill.inventory()).toEqual([{ ...review, enabled: true, inherited: false, defaultEnabled: false }])

      expect(yield* skill.setEnabled(review.id, undefined)).toBe(true)
      expect(yield* skill.get(review.id)).toBeUndefined()
      expect(yield* skill.inventory()).toEqual([{ ...review, enabled: false, inherited: true, defaultEnabled: false }])
    }),
  )

  it.effect("restores earlier values when an updating transform is disposed", () =>
    Effect.gen(function* () {
      const skill = yield* Skill.Service
      const original = info("review", "Initial")
      yield* skill.transform((draft) => draft.add(original))
      const updated = yield* skill.transform((draft) =>
        draft.update("review", (value) => {
          value.description = "Updated"
        }),
      )

      expect((yield* skill.list())[0]?.description).toBe("Updated")
      yield* updated.dispose
      expect((yield* skill.list())[0]?.description).toBe("Initial")
      expect(original.description).toBe("Initial")
    }),
  )

  it.live("publishes updates after committed values are visible", () =>
    Effect.gen(function* () {
      const skill = yield* Skill.Service
      const bus = yield* Bus.Service
      const updated = yield* Deferred.make<Skill.Info[]>()
      const fiber = yield* bus.subscribe(Skill.Event.Updated).pipe(
        Stream.runForEach(() => skill.list().pipe(Effect.flatMap((values) => Deferred.succeed(updated, values)))),
        Effect.forkScoped,
      )
      yield* Effect.yieldNow

      yield* skill.transform((draft) => draft.add(info("review", "Visible")))
      expect(yield* Deferred.await(updated).pipe(Effect.timeout("1 second"))).toEqual([info("review", "Visible")])
      yield* Fiber.interrupt(fiber)
    }),
  )

  it.effect("filters values by agent permissions", () =>
    Effect.gen(function* () {
      const agents = yield* Agent.Service
      yield* agents.transform((draft) =>
        draft.update(Agent.ID.make("reviewer"), (agent) => {
          agent.permissions.push({ action: "skill", resource: "deploy", effect: "deny" })
        }),
      )
      const agent = yield* agents.get(Agent.ID.make("reviewer"))
      expect(Skill.available([info("deploy", "Deploy")], agent!)).toEqual([])
    }),
  )
})
