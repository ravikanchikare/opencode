import { expect, test } from "@playwright/test"
import { fixture, pageMessages } from "../performance/timeline/session-timeline-stress.fixture"
import { installStressSessionTabs, stressSessionHref } from "../performance/timeline/timeline-test-helpers"
import { mockOpenCodeServer } from "../utils/mock-server"

test.use({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } })

test("project icons follow the saved preference in every build channel", async ({ page }) => {
  await mockOpenCodeServer(page, {
    directory: fixture.directory,
    project: fixture.project,
    sessions: fixture.sessions,
    provider: fixture.provider,
    pageMessages,
  })
  await installStressSessionTabs(page)
  await page.goto(stressSessionHref(fixture.sourceID))
  const header = page.locator("[data-session-title]")
  const trigger = header.getByRole("button", { name: fixture.project.name, exact: true })
  const avatar = trigger.locator('[data-component="project-avatar-v2"]')
  await expect(header.getByRole("heading")).toHaveText(fixture.expected.sourceTitle)
  await expect(trigger.locator("use")).toHaveAttribute("href", "#opencode-v2-icon-monitor")
  await expect(avatar).toHaveCount(0)

  for (const enabled of [true, false]) {
    await page.goto("/")
    await page.getByRole("button", { name: "Settings", exact: true }).click()
    const settings = page.getByTestId("settings-screen")
    await expect(settings.getByRole("tab", { name: "Worktrees", exact: true }).locator("use")).toHaveAttribute(
      "href",
      "#opencode-v2-icon-outline-worktree",
    )
    await settings.getByRole("tab", { name: "Experimental", exact: true }).click()
    const control = settings.locator('[data-action="settings-show-project-icon"]')
    await expect(control.getByRole("switch")).toBeChecked({ checked: !enabled })
    await control.locator('[data-slot="switch-control"]').click()
    await expect(control.getByRole("switch")).toBeChecked({ checked: enabled })
    await settings.getByRole("button", { name: "Back to app", exact: true }).click()
    await page.goto(stressSessionHref(fixture.sourceID))
    await expect(header.getByRole("heading")).toHaveText(fixture.expected.sourceTitle)
    await expect(avatar).toHaveCount(enabled ? 1 : 0)
    if (enabled) await expect(avatar).toBeVisible()
    await page.reload()
    await expect(header.getByRole("heading")).toHaveText(fixture.expected.sourceTitle)
    await expect(avatar).toHaveCount(enabled ? 1 : 0)
  }
})
