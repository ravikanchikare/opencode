import { expect, test } from "@playwright/test"
import type { OpenCodeEvent, PluginInfo } from "@opencode/client"
import { mockOpenCodeServer } from "../utils/mock-server"

test("plugin matrix and flat tools preserve identity, schema disclosure, and delayed activation", async ({ page }) => {
  const directory = "/tmp/plugin-details"
  const project = {
    id: "proj_plugin_details",
    canonical: directory,
    name: "Plugin details project",
    vcs: "git",
    time: { created: 1, updated: 1 },
  }
  const events: OpenCodeEvent[] = []
  const location = { directory, project: { id: project.id, directory, canonical: directory } }
  const state = { effective: ["alpha:read", "beta:read"], pending: [] as string[] }
  const choices = [
    {
      value: "alpha:read",
      label: "Read",
      group: { id: "alpha", label: "Alpha" },
      tools: [{ name: "alpha.get", description: "Read Alpha.", input: { type: "object" } }],
    },
    {
      value: "alpha:write",
      label: "Write",
      group: { id: "alpha", label: "Alpha" },
      tools: [{ name: "alpha.update", description: "Update Alpha.", input: { type: "object", required: ["id"] } }],
    },
    {
      value: "alpha:delete",
      label: "Delete",
      group: { id: "alpha", label: "Alpha" },
      tools: [{ name: "alpha.delete", description: "Delete Alpha.", input: { type: "object", required: ["id"] } }],
    },
    {
      value: "beta:read",
      label: "Read",
      group: { id: "beta", label: "Beta" },
      tools: [{ name: "beta.get", description: "Read Beta.", input: { type: "object" } }],
    },
  ]
  const plugin = (): PluginInfo => ({
    id: "example.tools",
    name: "Example Tools",
    description: "This description belongs in the inventory.",
    source: { type: "local", path: "/private/plugin.ts" },
    features: { server: true },
    state: { status: "active" },
    options: {
      descriptors: [
        {
          type: "multi-select",
          key: "tools",
          label: "Tools",
          choices,
          default: ["alpha:read", "beta:read"],
        },
      ],
      scope: "location",
      inherited: true,
      effective: { tools: state.effective },
    },
  })
  const flat = (): PluginInfo => ({
    ...plugin(),
    id: "example.flat",
    name: "Example Flat Tools",
    options: {
      descriptors: [
        {
          type: "multi-select",
          key: "tools",
          label: "Tools",
          choices: [
            {
              value: "inspect",
              label: "inspect",
              tools: [{ name: "inspect", description: "Inspect the local state.", input: { type: "object" } }],
            },
          ],
          default: ["inspect"],
        },
      ],
      scope: "location",
      inherited: true,
      effective: { tools: ["inspect"] },
    },
  })
  await mockOpenCodeServer(page, {
    directory,
    project,
    sessions: [],
    pageMessages: () => ({ items: [] }),
    provider: { all: [], connected: [], default: {} },
    events: () => events.splice(0),
  })
  await page.route("**/api/project", (route) => route.fulfill({ json: [project] }))
  await page.addInitScript((directory) => {
    localStorage.setItem(
      "opencode.global.dat:server",
      JSON.stringify({ projects: { local: [{ worktree: directory, expanded: true }] } }),
    )
  }, directory)
  await page.route(/\/api\/plugin(?:\/|\?|$)/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 })
    if (url.pathname.endsWith("/options")) {
      state.pending = request.postDataJSON().value
      // The write completes before the fixture's activation event, like a file watcher.
      return route.fulfill({ json: { location, data: plugin() } })
    }
    if (url.pathname.endsWith("/await-activation")) return route.fulfill({ status: 204 })
    return route.fulfill({
      json: { location, data: url.searchParams.get("location[directory]") === directory ? [plugin(), flat()] : [] },
    })
  })
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  const settings = page.getByTestId("settings-screen")
  await settings.getByRole("tab", { name: "Projects", exact: true }).click()
  await settings.getByText(project.name, { exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("tab", { name: "Extensions", exact: true }).click()
  await dialog.getByRole("tab", { name: "Plugins", exact: true }).click()
  await dialog.getByRole("button", { name: /Example Flat Tools/ }).click()
  await expect(dialog.getByRole("heading", { name: "Example Flat Tools", exact: true })).toBeVisible()
  const flatSearch = dialog.getByRole("searchbox")
  const flatCard = dialog.locator('[data-component="settings-list"]')
  const flatToggle = dialog.getByRole("switch", { name: "inspect", exact: true })
  await expect(dialog.getByText("Inspect the local state.", { exact: true })).toHaveCount(1)
  await expect
    .poll(() =>
      flatSearch.evaluate((element) => {
        const row = element.closest(".plugin-search-row")!.getBoundingClientRect()
        const field = element.closest('[data-component="text-input-v2"]')!.getBoundingClientRect()
        return Math.abs(row.width - field.width)
      }),
    )
    .toBeLessThanOrEqual(1)
  await expect
    .poll(() =>
      flatCard.getByText("Inspect the local state.", { exact: true }).evaluate((description) => {
        const text = description.getBoundingClientRect()
        const padding = Number.parseFloat(getComputedStyle(description).paddingRight)
        const control = description
          .closest(".plugin-flat-tool")!
          .querySelector('[data-component="switch"]')!
          .getBoundingClientRect()
        return control.left - (text.right - padding)
      }),
    )
    .toBeGreaterThanOrEqual(24)
  await dialog.getByRole("button", { name: "Input schema for inspect", exact: true }).click()
  await expect(dialog.locator("pre").filter({ hasText: '"type": "object"' })).toBeVisible()
  await expect(dialog.getByText("Inspect the local state.", { exact: true })).toHaveCount(1)
  await dialog.getByRole("button", { name: "Plugins", exact: true }).click()
  await dialog.getByRole("button", { name: /^Example Tools/ }).click()
  await expect(dialog.getByRole("heading", { name: "Example Tools", exact: true })).toBeVisible()
  await expect(dialog.getByText("example.tools", { exact: true })).toHaveCount(0)
  await expect(dialog.getByRole("heading", { name: "Tools", exact: true })).toHaveCount(0)
  await expect(dialog.getByText("/private/plugin.ts", { exact: true })).toHaveCount(0)
  await expect(dialog.getByText("Active", { exact: true })).toHaveCount(0)
  await expect(dialog.getByText("1 operation", { exact: true })).toHaveCount(0)
  await dialog.getByRole("button", { name: "Alpha", exact: true }).click()
  await expect(dialog.getByText("Update Alpha.", { exact: true })).toBeVisible()
  const write = dialog.getByRole("switch", { name: "Alpha: Write", exact: true })
  const saved = page.waitForResponse(
    (response) => response.request().method() === "PUT" && response.url().includes("/options"),
  )
  await write.locator("..").locator('[data-slot="switch-control"]').click()
  await saved
  await expect(write).toBeEnabled()
  state.effective = state.pending
  events.push({ id: "evt_plugin_changed", type: "plugin.updated", data: {}, location: { directory } })
  await expect(write).toBeChecked()
  await expect(dialog.getByRole("switch", { name: "Beta: Read", exact: true })).toBeChecked()
  await expect(dialog.getByRole("switch", { name: "Beta: Write", exact: true })).toHaveCount(0)
  await expect(dialog.getByRole("button", { name: "Alpha", exact: true })).toHaveAttribute("aria-expanded", "true")
  await expect(dialog.getByText("Read", { exact: true })).toBeVisible()
  await expect(dialog.getByText("Write", { exact: true })).toBeVisible()
  await expect(dialog.getByText("Delete", { exact: true })).toBeVisible()
  await expect
    .poll(() =>
      dialog.evaluate((element) => {
        const title = element.querySelector(".plugin-details-title-row .settings-tab-title")!.getBoundingClientRect()
        const action = [...element.querySelectorAll(".plugin-details-title-row button")]
          .find((button) => button.textContent?.trim() === "Enable all")!
          .getBoundingClientRect()
        return Math.abs(title.y + title.height / 2 - action.y - action.height / 2)
      }),
    )
    .toBeLessThanOrEqual(1)
  for (const width of [1280, 720, 390]) {
    await page.setViewportSize({ width, height: 844 })
    const card = dialog.locator('[data-component="settings-list"]')
    await expect(card.locator(":scope > .plugin-domain")).toHaveCount(2)
    await expect
      .poll(() =>
        card.evaluate((element) => {
          const bounds = element.getBoundingClientRect()
          return Math.max(
            ...[...element.querySelectorAll(":scope > .plugin-domain")].flatMap((row) => {
              const box = row.getBoundingClientRect()
              return [Math.abs(box.left - bounds.left), Math.abs(box.right - bounds.right)]
            }),
          )
        }),
      )
      .toBeLessThanOrEqual(1)
    await expect
      .poll(() => dialog.evaluate((element) => element.scrollWidth - element.clientWidth))
      .toBeLessThanOrEqual(1)
    await expect
      .poll(() =>
        dialog.evaluate((element) => {
          const search = element.querySelector(".plugin-search-row")!.getBoundingClientRect()
          const headings = [...element.querySelectorAll(".plugin-search-row > span")]
          const cells = [
            ...element
              .querySelector(".plugin-domain .plugin-control-columns")!
              .querySelectorAll(".plugin-control-cell"),
          ]
          return Math.max(
            ...headings.map((heading, index) => {
              const a = heading.getBoundingClientRect()
              const b = cells[index]!.getBoundingClientRect()
              return Math.max(
                Math.abs(a.x + a.width / 2 - b.x - b.width / 2),
                Math.abs(a.y + a.height / 2 - search.y - search.height / 2),
              )
            }),
          )
        }),
      )
      .toBeLessThanOrEqual(1)
  }
})
