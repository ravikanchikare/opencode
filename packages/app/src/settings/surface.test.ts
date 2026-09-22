import { afterEach, expect, test } from "bun:test"
import { configureAppComposition } from "@/composition"
import { resolveProjectSettingsView, type SettingsView } from "./surface"

const project = {
  type: "project",
  server: "local",
  project: "/project",
  parent: "root",
} as const

const composition = {
  settingsTabs: {
    add: [
      { value: "skills", label: "Skills", icon: "post-skill", panel: "skills" },
      { value: "mcp", label: "MCP", icon: "mcp", panel: "mcp" },
      { value: "plugins", label: "Plugins", icon: "cube", panel: "plugins" },
    ],
  },
} as const

afterEach(() => configureAppComposition({}))

test("legacy project extension deep links resolve to composed destinations", () => {
  configureAppComposition(composition)
  expect(resolveProjectSettingsView({ ...project, tab: "extensions", subtab: "mcps" })).toEqual({
    ...project,
    tab: "mcp",
    subtab: undefined,
  })
  expect(resolveProjectSettingsView({ ...project, tab: "extensions", subtab: "lsps" })).toEqual({
    ...project,
    tab: "extensions",
    subtab: "lsps",
  })
})

test("stock project settings retain Extensions and normalize unavailable composed destinations", () => {
  const legacy: SettingsView = { ...project, tab: "extensions", subtab: "skills" }
  expect(resolveProjectSettingsView(legacy)).toBe(legacy)
  expect(resolveProjectSettingsView({ ...project, tab: "plugins" })).toEqual({
    ...project,
    tab: "extensions",
    subtab: "plugins",
  })
  expect(resolveProjectSettingsView({ ...project, tab: "language-servers" })).toEqual({
    ...project,
    tab: "extensions",
    subtab: "lsps",
  })
})
