import { composedProjectExtensionTabs, isComposedSettingsTab, projectExtensionDestination } from "./tabs"
import type { SettingsTabComposition } from "./tabs"

export type SettingsRootTab =
  | "general"
  | "appearance"
  | "notifications"
  | "shortcuts"
  | "pairing"
  | "projects"
  | "workspaces"
  | "providers"
  | "models"
  | "extensions"
  | "servers"
  | "experimental"
  | "about"

export type SettingsServerTab = "general" | "projects" | "workspaces" | "providers" | "models" | "extensions"
export type SettingsProjectTab =
  | "general"
  | "workspaces"
  | "extensions"
  | "skills"
  | "mcp"
  | "plugins"
  | "language-servers"

export type SettingsView = (
  | { type: "root"; tab: SettingsRootTab }
  | { type: "server"; server: string; tab: SettingsServerTab }
  | {
      type: "project"
      server: string
      project: string
      tab: SettingsProjectTab
      parent: "root" | "server"
    }
) & {
  target?: string
  subtab?: "mcps" | "plugins" | "skills" | "lsps"
  searchActivation?: number
}

export type SettingsTransientView = Pick<SettingsView, "target" | "searchActivation">

const rootTabs: Record<SettingsRootTab, true> = {
  general: true,
  appearance: true,
  notifications: true,
  shortcuts: true,
  pairing: true,
  projects: true,
  workspaces: true,
  providers: true,
  models: true,
  extensions: true,
  servers: true,
  experimental: true,
  about: true,
}
const serverTabs: Record<SettingsServerTab, true> = {
  general: true,
  projects: true,
  workspaces: true,
  providers: true,
  models: true,
  extensions: true,
}
const projectTabs: Record<SettingsProjectTab, true> = {
  general: true,
  workspaces: true,
  extensions: true,
  skills: true,
  mcp: true,
  plugins: true,
  "language-servers": true,
}
const subtabs: Record<NonNullable<SettingsView["subtab"]>, true> = {
  mcps: true,
  plugins: true,
  skills: true,
  lsps: true,
}

export function parseSettingsView(
  search: string,
  multipleServers: boolean,
  transient?: SettingsTransientView,
  composition?: SettingsTabComposition,
): SettingsView {
  const params = new URLSearchParams(search)
  const tab = params.get("tab") ?? "general"
  const server = params.get("server")
  const project = params.get("project")
  const subtab = params.get("subtab")
  const nested = subtab && isSubtab(subtab) && tab === "extensions" ? subtab : undefined

  if (project && server && isProjectTab(tab, composition)) {
    return {
      type: "project",
      server,
      project,
      parent: multipleServers ? "server" : "root",
      tab,
      subtab: nested,
      ...transient,
    }
  }
  if (!project && server && isServerTab(tab, composition))
    return { type: "server", server, tab, subtab: nested === "lsps" ? undefined : nested, ...transient }
  if (!project && !server && isRootTab(tab, composition))
    return { type: "root", tab, subtab: nested === "lsps" ? undefined : nested, ...transient }
  return { type: "root", tab: "general", ...transient }
}

export function settingsViewUrl(view: SettingsView) {
  const params = new URLSearchParams()
  if (view.type !== "root") params.set("server", view.server)
  if (view.type === "project") params.set("project", view.project)
  if (view.tab !== "general") params.set("tab", view.tab)
  if (view.tab === "extensions" && view.subtab) params.set("subtab", view.subtab)
  const search = params.toString()
  return search ? `/settings?${search}` : "/settings"
}

type RedirectServer = { key: string; connected: boolean; starting: boolean }

/** Where a server or project view must go when its server is gone, unreachable, or the only one. */
export function settingsViewRedirect(input: {
  view: SettingsView
  /** False while the saved, WSL, and SSH server lists load; a restored route waits for them. */
  loaded: boolean
  servers: readonly RedirectServer[]
}): { type: "back" } | { type: "server"; server: string } | { type: "root"; tab: SettingsRootTab } | undefined {
  const view = input.view
  if (view.type === "root" || !input.loaded) return
  const server = input.servers.find((item) => item.key === view.server)
  if (!server) return { type: "back" }
  // A starting WSL or SSH server connects shortly; only an unavailable one leaves the project page.
  if (view.type === "project" && !server.connected && !server.starting) return { type: "server", server: server.key }
  if (view.type === "server" && input.servers.length === 1)
    return { type: "root", tab: view.tab === "general" ? "servers" : view.tab }
}

export function isRootTab(value: string, composition?: SettingsTabComposition): value is SettingsRootTab {
  return Object.hasOwn(rootTabs, value) || isComposedSettingsTab(value, composition)
}

export function isServerTab(value: string, composition?: SettingsTabComposition): value is SettingsServerTab {
  return Object.hasOwn(serverTabs, value) || isComposedSettingsTab(value, composition)
}

export function isProjectTab(value: string, composition?: SettingsTabComposition): value is SettingsProjectTab {
  if (!Object.hasOwn(projectTabs, value)) return false
  if (value === "general" || value === "workspaces" || value === "extensions") return true
  return composedProjectExtensionTabs(composition)?.some((entry) => entry.value === value) ?? false
}

/** Where a project view's `extensions` tab (or a legacy subtab) must land once composed tabs promote it. */
export function resolveProjectSettingsView(view: SettingsView, composition?: SettingsTabComposition): SettingsView {
  if (view.type !== "project") return view
  if (view.tab === "extensions") {
    const tab = projectExtensionDestination(view.subtab, composition)
    if (tab === "extensions" || !isProjectTab(tab, composition)) return view
    return { ...view, tab, subtab: undefined }
  }
  if (view.tab === "general" || view.tab === "workspaces" || isProjectTab(view.tab, composition)) return view
  const subtab = view.tab === "mcp" ? "mcps" : view.tab === "language-servers" ? "lsps" : view.tab
  return { ...view, tab: "extensions", subtab }
}

function isSubtab(value: string): value is NonNullable<SettingsView["subtab"]> {
  return Object.hasOwn(subtabs, value)
}
