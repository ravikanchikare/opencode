import { expect, test } from "bun:test"
import { fromPromise } from "../src/promise/adapter"
import type { Plugin } from "../src/promise/plugin"

test("the Promise adapter preserves authored identity and option catalogs", () => {
  const plugin = {
    id: "acme.api",
    name: "Acme API",
    description: "Acme tools",
    options: [
      {
        type: "multi-select",
        key: "domains",
        label: "Domains",
        choices: [
          {
            value: "records",
            label: "Records",
            tools: [{ name: "records-list", description: "List records", input: { type: "object" } }],
          },
        ],
      },
    ],
    setup: async () => {},
  } satisfies Plugin
  const adapted = fromPromise(plugin)
  expect(adapted.name).toBe(plugin.name)
  expect(adapted.description).toBe(plugin.description)
  expect(adapted.options).toBe(plugin.options)
})
