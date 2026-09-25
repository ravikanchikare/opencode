import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Permission } from "@opencode/core/permission"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { Skill } from "@opencode/core/skill"
import { SkillTool } from "@opencode/core/tool/plugin/skill"
import { Tool } from "@opencode/core/tool"
import { tmpdir } from "./fixture/tmpdir"
import { Image } from "@opencode/core/image"
import { it } from "./lib/effect"
import { imagePassthrough } from "./lib/image"
import { permissionLayer } from "./lib/permission"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { FSUtil } from "@opencode/util/fs-util"
import { toolIdentity, executeTool, registerToolPlugin, toolDefinitions } from "./lib/tool"

const skillToolNode = makeLocationNode({
  name: "test/skill-tool-plugin",
  layer: Layer.effectDiscard(registerToolPlugin(SkillTool.Plugin)),
  deps: [Tool.node, FSUtil.node, Skill.node, Permission.node],
})

const sessionID = Session.ID.make("ses_skill_tool_test")

describe("SkillTool", () => {
  it.live("lists available skills, authorizes the selected ID, and loads model-facing content", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const directory = path.join(tmp.path, "effect")
          const location = path.join(directory, "SKILL.md")
          const reference = path.join(directory, "reference.md")
          yield* Effect.promise(() => fs.mkdir(directory, { recursive: true }))
          yield* Effect.promise(() =>
            Promise.all([fs.writeFile(location, "unused"), fs.writeFile(reference, "reference")]),
          )

          const info: Skill.Info = {
            id: Skill.ID.make("effect"),
            name: Skill.Name.make("Effect"),
            description: "Use Effect",
            path: AbsolutePath.make(location),
            content: "# Effect\n\nGuidance",
          }
          let current = [info]
          const assertions: Permission.AssertInput[] = []
          let deny = false
          const permission = permissionLayer({
            assert: (input) =>
              Effect.sync(() => assertions.push(input)).pipe(
                Effect.andThen(
                  deny
                    ? Effect.fail(
                        new Permission.BlockedError({
                          rules: [],
                          permission: input.action,
                          resources: input.resources,
                        }),
                      )
                    : Effect.void,
                ),
              ),
          })
          const skills = Layer.mock(Skill.Service, {
            get: (id) => Effect.succeed(current.find((skill) => skill.id === id)),
            list: () => Effect.succeed(current),
          })
          const skillToolLayer = AppNodeBuilder.build(LayerNode.group([Tool.node, skillToolNode]), [
            Permission.node.replace(permission),
            Skill.node.replace(skills),
            Image.node.replace(imagePassthrough),
          ])

          return yield* Effect.gen(function* () {
            const registry = yield* Tool.Service
            expect((yield* toolDefinitions(registry))[0]).toMatchObject({
              name: "skill",
              description: SkillTool.description,
            })
            expect(
              yield* executeTool(registry, {
                sessionID,
                ...toolIdentity,
                call: { type: "tool-call", id: "call-skill", name: "skill", input: { id: "effect" } },
              }),
            ).toMatchObject({
              status: "completed",
              content: [{ type: "text", text: Skill.toModelOutput(info, [reference]) }],
            })
            expect(Skill.toModelOutput(info, [reference])).toContain(`Base directory for this skill: ${directory}`)
            expect(
              yield* executeTool(registry, {
                sessionID,
                ...toolIdentity,
                call: { type: "tool-call", id: "call-skill-overflow", name: "skill", input: { id: "effect" } },
              }),
            ).toEqual({
              status: "completed",
              output: { name: "Effect", directory, output: Skill.toModelOutput(info, [reference]) },
              content: [{ type: "text", text: Skill.toModelOutput(info, [reference]) }],
              metadata: { name: "Effect", directory },
            })
            expect(assertions).toMatchObject([
              { sessionID, action: "skill", resources: ["effect"], save: ["effect"] },
              { sessionID, action: "skill", resources: ["effect"], save: ["effect"] },
            ])
            expect(
              yield* executeTool(registry, {
                sessionID,
                ...toolIdentity,
                call: { type: "tool-call", id: "call-missing-skill", name: "skill", input: { id: "missing" } },
              }),
            ).toEqual({
              status: "error",
              error: { type: "tool.execution", message: "Unable to load skill missing" },
            })
            deny = true
            expect(
              yield* executeTool(registry, {
                sessionID,
                ...toolIdentity,
                call: { type: "tool-call", id: "call-denied-skill", name: "skill", input: { id: "effect" } },
              }),
            ).toEqual({
              status: "error",
              error: { type: "permission.rejected", message: "Permission denied: skill" },
            })
            deny = false
            const flat = Skill.Info.make({
              id: Skill.ID.make("public"),
              name: Skill.Name.make("Public"),
              description: "Public guidance",
              path: AbsolutePath.make(path.join(tmp.path, "public.md")),
              content: "Public",
            })
            yield* Effect.promise(() =>
              Promise.all([
                fs.writeFile(flat.path, "public"),
                fs.writeFile(path.join(tmp.path, "secret.md"), "secret"),
              ]),
            )
            current = [flat]
            expect(
              yield* executeTool(registry, {
                sessionID,
                ...toolIdentity,
                call: { type: "tool-call", id: "call-flat-skill", name: "skill", input: { id: "public" } },
              }),
            ).toMatchObject({
              status: "completed",
              content: [{ type: "text", text: Skill.toModelOutput(flat, []) }],
            })
          }).pipe(Effect.provide(skillToolLayer))
        }),
      ),
    ),
  )

  it.live("serves embedded resources by name without exposing the skill's install directory", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const directory = path.join(tmp.path, "installed", "guide.skills", "guide")
          const location = path.join(directory, "SKILL.md")
          const sibling = path.join(directory, "recovery.md")
          yield* Effect.promise(() => fs.mkdir(directory, { recursive: true }))
          yield* Effect.promise(() => Promise.all([fs.writeFile(location, "unused"), fs.writeFile(sibling, "on disk")]))

          const info: Skill.Info = {
            id: Skill.ID.make("guide"),
            name: Skill.Name.make("Guide"),
            description: "Guidance with resources",
            path: AbsolutePath.make(location),
            content: "# Guide\n\nLoad the recovery resource when blocked.",
            resources: [
              { name: "recovery", description: "What to do when blocked", content: "# Recovery\n\nReconcile first." },
              { name: "glossary", content: "Terms" },
            ],
          }
          const assertions: Permission.AssertInput[] = []
          const permission = permissionLayer({ assert: (input) => Effect.sync(() => assertions.push(input)) })
          const skills = Layer.mock(Skill.Service, {
            get: (id) => Effect.succeed(id === info.id ? info : undefined),
            list: () => Effect.succeed([info]),
          })
          const skillToolLayer = AppNodeBuilder.build(LayerNode.group([Tool.node, skillToolNode]), [
            Permission.node.replace(permission),
            Skill.node.replace(skills),
            Image.node.replace(imagePassthrough),
          ])

          return yield* Effect.gen(function* () {
            const registry = yield* Tool.Service
            const loaded = yield* executeTool(registry, {
              sessionID,
              ...toolIdentity,
              call: { type: "tool-call", id: "call-guide", name: "skill", input: { id: "guide" } },
            })
            const text = Skill.toModelOutput(info, [])
            expect(loaded).toMatchObject({ status: "completed", content: [{ type: "text", text }] })
            expect(text).toContain('<resource name="recovery">What to do when blocked</resource>')
            expect(text).toContain('<resource name="glossary" />')
            expect(text).not.toContain(directory)
            expect(text).not.toContain("<skill_files>")

            expect(
              yield* executeTool(registry, {
                sessionID,
                ...toolIdentity,
                call: {
                  type: "tool-call",
                  id: "call-guide-recovery",
                  name: "skill",
                  input: { id: "guide", resource: "recovery" },
                },
              }),
            ).toMatchObject({
              status: "completed",
              content: [{ type: "text", text: Skill.resourceOutput(info, info.resources![0]) }],
            })
            expect(Skill.resourceOutput(info, info.resources![0])).toContain("Reconcile first.")

            // Skills refer to "its Recovery resource"; the lookup ignores case.
            expect(
              yield* executeTool(registry, {
                sessionID,
                ...toolIdentity,
                call: {
                  type: "tool-call",
                  id: "call-guide-recovery-cased",
                  name: "skill",
                  input: { id: "guide", resource: "Recovery" },
                },
              }),
            ).toMatchObject({
              status: "completed",
              content: [{ type: "text", text: Skill.resourceOutput(info, info.resources![0]) }],
            })

            expect(
              yield* executeTool(registry, {
                sessionID,
                ...toolIdentity,
                call: {
                  type: "tool-call",
                  id: "call-guide-missing",
                  name: "skill",
                  input: { id: "guide", resource: "missing" },
                },
              }),
            ).toMatchObject({ status: "error" })

            // Only the skill permission is consulted: no file read, so no external_directory request.
            expect(assertions.every((input) => input.action === "skill")).toBe(true)
          }).pipe(Effect.provide(skillToolLayer))
        }),
      ),
    ),
  )
})
