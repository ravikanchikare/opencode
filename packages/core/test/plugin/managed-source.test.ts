import { describe, expect, test } from "bun:test"
import { ManagedPluginSource } from "@opencode-ai/core/plugin/managed-source"
import { Effect, Exit } from "effect"

describe("ManagedPluginSource", () => {
  test("decodes absolute managed plugin paths", async () => {
    const operations = await Effect.runPromise(
      ManagedPluginSource.operations({
        OPENCODE_MANAGED_PLUGINS: JSON.stringify(["/opt/acme/a.js", "/opt/acme/b.js"]),
      }),
    )

    expect(operations).toEqual([
      { type: "add", target: "/opt/acme/a.js", options: {} },
      { type: "add", target: "/opt/acme/b.js", options: {} },
    ])
  })

  test("rejects malformed, relative, and duplicate entries", async () => {
    const values = ['["unterminated"', JSON.stringify(["relative.js"]), JSON.stringify(["/a.js", "/a.js"])]

    for (const value of values) {
      const result = await Effect.runPromiseExit(ManagedPluginSource.operations({ OPENCODE_MANAGED_PLUGINS: value }))
      expect(Exit.isFailure(result)).toBe(true)
    }
  })
})
