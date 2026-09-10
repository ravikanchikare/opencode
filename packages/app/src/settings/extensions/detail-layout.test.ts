import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8")

test("full-page skill and plugin details use the shared Settings inset", () => {
  expect(read("./skill-details.tsx")).toContain("extension-destination settings-detail-page")
  expect(read("./panels.tsx")).toContain("extension-destination settings-detail-page")
  const css = read("../settings.css")
  expect(css).toContain("padding-block: var(--settings-content-top-inset)")
  expect(css).toContain("padding: var(--settings-content-top-inset) 0 32px")
  expect(css).toContain(
    ".settings-screen .settings-detail-page {\n  padding-block-start: var(--settings-content-top-inset);",
  )
  expect(css).toContain("--settings-content-top-inset: 48px")
  expect(css).toContain("--settings-content-top-inset: 12px")
  expect(read("./extensions.css")).not.toMatch(/\.skill-details\s*\{[^}]*padding-top/)
})

test("server selection shares the plugin back row instead of creating an empty row above it", () => {
  expect(read("./panels.tsx")).toContain("headerActions={<InlineServerSelect />}")
  expect(read("./panels.tsx")).not.toContain('class="plugin-details-toolbar"')
  expect(read("./plugin-options-editor.tsx")).toMatch(
    /class="plugin-details-toolbar"[\s\S]*class="plugin-details-back"[\s\S]*\{props.headerActions\}/,
  )
})

test("native inventory rows display descriptions in addition to availability or failure details", () => {
  expect(read("./shell.tsx")).toContain("{props.description}")
  expect(read("./panels.tsx")).toContain("description={plugin.description}")
  expect(read("./panels.tsx")).toContain("description={item.description}")
  expect(read("../workspaces/project-extensions.tsx")).toContain("description={item.description}")
})

test("inventory icons align with the title and text keeps a fixed gap from controls", () => {
  const css = read("./extensions.css")
  expect(css).toMatch(/\.extension-destination-label\s*\{[^}]*align-items: flex-start/)
  expect(css).toMatch(/\.extension-destination-row\s*\{[^}]*gap: 24px/)
  expect(css).toMatch(
    /\.skill-details-heading\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) max-content;[^}]*gap: 24px/,
  )
  expect(css).toMatch(/\.extension-destination-description\s*\{[^}]*overflow-wrap: anywhere/)
})
