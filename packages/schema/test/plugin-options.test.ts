import { expect, test } from "bun:test"
import { Schema } from "effect"
import { Plugin } from "../src/plugin.js"

test("option choice groups and one-level children cross the wire and stay optional for existing plugins", () => {
  const decode = Schema.decodeUnknownSync(Plugin.OptionChoice)
  expect(decode({ value: "one", label: "One" })).toEqual({ value: "one", label: "One" })
  const choice = {
    value: "one:read",
    label: "Read",
    group: { id: "one", label: "One", description: "First group" },
  }
  expect(Schema.encodeSync(Plugin.OptionChoice)(decode(choice))).toEqual(choice)
  expect(() => decode({ ...choice, group: { label: "Missing identity" } })).toThrow()
  const nested = {
    value: "data",
    label: "Data",
    children: [{ value: "data:read", label: "Read", group: { id: "records", label: "Records" } }],
  }
  expect(Schema.encodeSync(Plugin.OptionChoice)(decode(nested))).toEqual(nested)
  expect(() => decode({ ...nested, children: [{ value: "data:read", label: "Read" }] })).toThrow()
  expect(
    decode({ ...nested, children: [{ ...nested.children[0], children: [] }] }).children?.[0],
  ).not.toHaveProperty("children")
})
