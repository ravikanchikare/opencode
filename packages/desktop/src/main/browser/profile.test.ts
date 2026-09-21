import { expect, test } from "bun:test"
import { resolveBrowserProfile } from "./profile"

test("persistent browser profiles are stable and scoped to a server", () => {
  const first = resolveBrowserProfile("https://one.example", "work")
  expect(first?.partition.startsWith("persist:opencode-browser-")).toBe(true)
  expect(resolveBrowserProfile("https://one.example", "work")?.partition).toBe(first?.partition)
  expect(resolveBrowserProfile("https://two.example", "work")?.partition).not.toBe(first?.partition)
  expect(resolveBrowserProfile("https://one.example", "personal")?.partition).not.toBe(first?.partition)
})

test("invalid profile IDs do not resolve to persistent partitions", () => {
  for (const id of ["", "UPPERCASE", "persist:work", "../work", "a".repeat(65)]) {
    expect(resolveBrowserProfile("https://one.example", id)).toBeUndefined()
  }
})
