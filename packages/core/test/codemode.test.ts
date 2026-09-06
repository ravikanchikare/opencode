import { describe, expect } from "bun:test"
import { Agent } from "@opencode/core/agent"
import { CodeModeTool } from "@opencode/core/codemode/tool"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Location } from "@opencode/core/location"
import { Permission } from "@opencode/core/permission"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { SessionMessage } from "@opencode/core/session/message"
import { Tool } from "@opencode/core/tool"
import type { Info } from "@opencode/schema/tool"
import { Cause, Effect, Schema } from "effect"
import { it } from "./lib/effect"

describe("CodeMode", () => {
  it.effect("owns registrations, execute, and catalog materialization", () =>
    Effect.gen(function* () {
      const tools = yield* Tool.Service
      yield* tools.transform((editor) => {
        editor.namespace({ name: "empty", description: "No tools registered yet" })
        editor.add({
          name: "echo",
          description: "Echo text",
          input: Schema.Struct({ text: Schema.String }),
          output: Schema.String,
          options: { pinned: true },
          execute: ({ text }) => Effect.succeed({ output: text }),
        })
      })

      const snapshot = yield* tools.snapshot()
      expect(snapshot.definitions.some((tool) => tool.name === "execute")).toBe(true)
      expect(snapshot.codeModeCatalog).toStrictEqual({
        tools: [
          {
            type: "tool",
            name: "echo",
            description: "Echo text",
            signature: "tools.echo(input: {\n  text: string,\n}): Promise<string>",
            pinned: true,
          },
          {
            type: "namespace",
            name: "empty",
            description: "No tools registered yet",
            tools: [],
          },
        ],
      })
    }).pipe(
      Effect.scoped,
      Effect.provide(
        AppNodeBuilder.build(Tool.node, [
          Location.node.replace(Location.boundNode({ directory: AbsolutePath.make("/project") })),
        ]),
      ),
    ),
  )

  it.effect("propagates declined embedded tool execution instead of returning null", () =>
    Effect.gen(function* () {
      let executions = 0
      const embedded: Info = {
        name: "declined",
        description: "Requires approval",
        input: Schema.Struct({}),
        output: Schema.String,
        execute: () => Effect.die(new Permission.DeclinedError()),
      }
      const codeMode = CodeModeTool.create({ tools: new Map([["declined", embedded]]) }, () =>
        Effect.sync(() => {
          executions += 1
        }).pipe(Effect.andThen(Effect.die(new Permission.DeclinedError()))),
      )
      const exit = yield* codeMode
        .execute(
          { code: "try { return await tools.declined() } catch { return null }" },
          {
            sessionID: Session.ID.make("ses_codemode"),
            agent: Agent.ID.make("build"),
            messageID: SessionMessage.ID.make("msg_codemode"),
            id: Tool.CallID.make("call_codemode"),
            progress: () => Effect.void,
          },
        )
        .pipe(Effect.exit)

      expect(exit._tag).toBe("Failure")
      expect(executions).toBe(1)
      if (exit._tag === "Failure")
        expect(
          exit.cause.reasons.some(
            (reason) => Cause.isDieReason(reason) && reason.defect instanceof Permission.DeclinedError,
          ),
        ).toBe(true)
    }).pipe(
      Effect.scoped,
      Effect.provide(
        AppNodeBuilder.build(Tool.node, [
          Location.node.replace(Location.boundNode({ directory: AbsolutePath.make("/project") })),
        ]),
      ),
    ),
  )
})
