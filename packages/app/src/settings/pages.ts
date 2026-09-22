import type { IconProps } from "@opencode/ui/icon"
import type { useLanguage } from "@/runtime/i18n/language"
import type { SettingsProjectTab, SettingsRootTab } from "./surface"

export const pageIcons = {
  general: "sliders",
  appearance: "appearance",
  notifications: "notifications",
  shortcuts: "keyboard",
  pairing: "server",
  projects: "folder",
  workspaces: "outline-worktree",
  providers: "providers",
  models: "models",
  extensions: "extensions",
  skills: "post-skill",
  mcp: "mcp",
  plugins: "cube",
  "language-servers": "code",
  servers: "server",
  experimental: "flask",
  about: "info",
} as const satisfies Record<SettingsRootTab | SettingsProjectTab, IconProps["name"]>

export const pageLabels = {
  general: "settings.tab.preferences",
  appearance: "settings.general.section.appearance",
  notifications: "settings.tab.notifications",
  shortcuts: "settings.shortcuts.title",
  pairing: "settings.pairing.title",
  projects: "settings.tab.projects",
  workspaces: "settings.tab.workspaces",
  providers: "settings.providers.title",
  models: "settings.models.title",
  extensions: "settings.tab.extensions",
  skills: "settings.extensions.tab.skills",
  mcp: "project.settings.extensions.mcp",
  plugins: "status.popover.tab.plugins",
  "language-servers": "project.settings.extensions.languageServers",
  servers: "settings.section.server",
  experimental: "settings.tab.experimental",
  about: "settings.tab.about",
} as const satisfies Record<SettingsRootTab | SettingsProjectTab, Parameters<ReturnType<typeof useLanguage>["t"]>[0]>
