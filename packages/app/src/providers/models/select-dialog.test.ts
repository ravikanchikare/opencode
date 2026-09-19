import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./select-dialog.tsx", import.meta.url), "utf8")

test("redirects an empty configured picker to provider settings before opening", () => {
  expect(source).toContain('emptyModelCatalogDestination() === "providers" && props.models("").length === 0')
  expect(source).toContain('settings.open("providers")')
})
