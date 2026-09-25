export * as SkillTool from "./skill.js"

import type { Context } from "@opencode/plugin/effect/plugin"
import { ToolFailure } from "@opencode/ai"
import { Effect, Schema } from "effect"
import { FSUtil } from "@opencode/util/fs-util"
import { Skill } from "../../skill.js"
import { Permission } from "../../permission.js"

export const name = "skill"

export const Input = Schema.Struct({
  id: Skill.ID.annotate({ description: "The ID of an available skill or a skill explicitly referenced by the user" }),
  resource: Schema.optional(
    Schema.String.annotate({
      description: "The name of a resource the loaded skill lists under <skill_resources>; omit to load the skill itself",
    }),
  ),
})

export const Output = Schema.Struct({
  name: Skill.Name,
  directory: Schema.String,
  output: Schema.String,
})
export const description = [
  "Load a specialized skill's instructions and resources into the current conversation when the task at hand matches its description.",
  "",
  "The skill ID must match an available skill or a skill explicitly referenced by the user.",
  "When a loaded skill lists <skill_resources>, load one by passing its name as `resource` with the same skill ID.",
].join("\n")

export const toModelOutput = Skill.toModelOutput

const unableToLoad = (name: string, error?: unknown) =>
  new ToolFailure({ message: `Unable to load skill ${name}`, error })

export const Plugin = {
  id: "opencode.tool.skill",
  effect: Effect.fn("SkillTool.Plugin")(function* (ctx: Context) {
    const fs = yield* FSUtil.Service
    const skills = yield* Skill.Service
    const permission = yield* Permission.Service
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name,
          options: { codemode: false },
          description,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              const skill = yield* skills.get(input.id)
              if (!skill) return yield* unableToLoad(input.id)
              return yield* Effect.gen(function* () {
                yield* permission.assert({
                  action: name,
                  resources: [skill.id],
                  save: [skill.id],
                  sessionID: context.sessionID,
                  agent: context.agent,
                  source: { type: "tool", messageID: context.messageID, id: context.id },
                })
                if (input.resource !== undefined) {
                  const wanted = input.resource.trim().toLowerCase()
                  const resource = skill.resources?.find((entry) => entry.name.toLowerCase() === wanted)
                  if (!resource) {
                    const names = (skill.resources ?? []).map((entry) => entry.name)
                    return yield* Effect.fail(
                      new Error(
                        `Skill ${skill.id} has no resource named ${input.resource}` +
                          (names.length > 0 ? `; available: ${names.join(", ")}` : "; it has no resources"),
                      ),
                    )
                  }
                  return { name: skill.name, directory: "", output: Skill.resourceOutput(skill, resource) }
                }
                return { name: skill.name, ...(yield* Skill.prepare(fs, skill)) }
              }).pipe(Effect.mapError((error) => unableToLoad(input.id, error)))
            }).pipe(
              Effect.map((output) => ({
                output,
                content: output.output,
                metadata: { name: output.name, directory: output.directory },
              })),
            ),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
