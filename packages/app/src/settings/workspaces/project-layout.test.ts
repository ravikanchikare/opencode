import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"

test("the worktree startup editor aligns with the project detail rows", () => {
  const css = readFileSync(new URL("./project.css", import.meta.url), "utf8")
  expect(css).toMatch(/\.project-settings-startup\s*\{[^}]*padding-inline: 16px;[^}]*padding-block: 20px;/)
})
