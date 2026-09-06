import { Plugin } from "@opencode-ai/core/plugin"
import { Skill } from "@opencode-ai/core/skill"
import { SkillNotFoundError } from "@opencode-ai/protocol/errors"
import { Effect } from "effect"
import { HttpServerRequest } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiSchema } from "effect/unstable/httpapi"
import { Api } from "../api"
import { hasLocationQuery, response } from "../location"

export const SkillHandler = HttpApiBuilder.group(Api, "server.skill", (handlers) =>
  handlers
    .handle(
      "skill.list",
      Effect.fn(function* () {
        const plugin = yield* Plugin.Service
        yield* plugin.awaitActivation
        return yield* response(Skill.Service.use((skill) => skill.list()))
      }),
    )
    .handle(
      "skill.inventory",
      Effect.fn(function* () {
        const plugin = yield* Plugin.Service
        yield* plugin.awaitActivation
        const scope = hasLocationQuery(yield* HttpServerRequest.HttpServerRequest)
          ? ("location" as const)
          : ("default" as const)
        return yield* response(Skill.Service.use((skill) => skill.inventory(scope)))
      }),
    )
    .handle(
      "skill.setEnabled",
      Effect.fn(function* (ctx) {
        const plugin = yield* Plugin.Service
        yield* plugin.awaitActivation
        const skill = yield* Skill.Service
        const scope = hasLocationQuery(yield* HttpServerRequest.HttpServerRequest)
          ? ("location" as const)
          : ("default" as const)
        const enabled = "enabled" in ctx.payload ? ctx.payload.enabled : undefined
        if (yield* skill.setEnabled(ctx.params.skill, enabled, scope)) return HttpApiSchema.NoContent.make()
        return yield* new SkillNotFoundError({
          skill: ctx.params.skill,
          message: `Skill not found: ${ctx.params.skill}`,
        })
      }),
    ),
)
