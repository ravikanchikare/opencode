import { expect, test } from "bun:test"

test("renders native pages that a composition hides from navigation", async () => {
  const source = await Bun.file(import.meta.dir + "/shell.tsx").text()

  expect(source).not.toContain("hiddenTabs")
  expect(source).toContain('<Tabs.Content value="appearance"')
  expect(source).toContain('<Tabs.Content value="experimental"')
  expect(source).toContain('<Tabs.Content value="about"')
  expect(source).toContain('<Tabs.Content value="extensions"')
  expect(source).toContain('<Tabs.Content value="servers"')
  expect(source).toContain('class="settings-about-config-path"')
})
