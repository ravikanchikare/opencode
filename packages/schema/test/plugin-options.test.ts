import { expect, test } from "bun:test"
import { Schema } from "effect"
import { Plugin } from "../src/plugin.js"

test("option choice groups cross the wire and stay optional for existing plugins", () => {
  const decode = Schema.decodeUnknownSync(Plugin.OptionChoice)
  expect(decode({ value: "one", label: "One" })).toEqual({ value: "one", label: "One" })
  const choice = {
    value: "one:read",
    label: "Read",
    group: { id: "one", label: "One", description: "First group" },
  }
  expect(Schema.encodeSync(Plugin.OptionChoice)(decode(choice))).toEqual(choice)
  expect(() => decode({ ...choice, group: { label: "Missing identity" } })).toThrow()
})
