import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./manage.tsx", import.meta.url), "utf8")
const settings = readFileSync(new URL("../../settings/settings.css", import.meta.url), "utf8")

test("guards provider connection through composition without changing the stock default", () => {
  expect(source).toContain("<Show when={showManageModelsConnectProvider()}>")
  expect(source).toContain('language.t("command.provider.connect")')
})

test("redirects an empty configured catalog to provider settings", () => {
  expect(source).toContain('emptyModelCatalogDestination() !== "providers" || local.model.list().length > 0')
  expect(source).toContain('settings.open("providers")')
})

test("aligns provider and model switches to the catalog content edge", () => {
  expect(source).toContain('class="settings-models-group-control"')
  expect(source).not.toContain('class="me-6"')
  expect(settings).toContain(`.settings-models-group-control {
  margin-inline-end: 16px;
}`)
  expect(settings).toContain(`[data-component="settings-list"][data-variant="catalog"] {
  --settings-list-row-padding: 16px;
  --settings-list-icon-gap: 8px;
  padding-inline: 16px;
}`)
})
