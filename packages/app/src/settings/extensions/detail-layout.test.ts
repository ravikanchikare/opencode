import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8")

test("full-page skill and plugin details use the shared Settings inset", () => {
  expect(read("./skill-details.tsx")).toContain("extension-destination settings-detail-page")
  expect(read("./panels.tsx")).toContain("extension-destination settings-detail-page")
  const css = read("../settings.css")
  expect(css).toContain("padding: var(--settings-content-top-inset) 0 0")
  expect(css).toContain(
    ".settings-screen .settings-detail-page {\n  padding-block-start: var(--settings-content-top-inset);",
  )
  expect(css).toContain("--settings-content-top-inset: 48px")
  expect(css).toContain("--settings-content-top-inset: 12px")
  expect(read("./extensions.css")).not.toMatch(/\.skill-details\s*\{[^}]*padding-top/)
})

test("plugin details own their toolbar instead of a panel stacking a second one above it", () => {
  expect(read("./panels.tsx")).not.toContain('class="plugin-details-toolbar"')
  expect(read("./plugin-options-editor.tsx")).toMatch(
    /class="plugin-details-toolbar"[\s\S]*class="plugin-details-back"[\s\S]*\{props.headerActions\}/,
  )
})
