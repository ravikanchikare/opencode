import {
  Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  startTransition,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import { Tabs } from "@opencode-ai/ui/tabs"
import { Icon, type IconProps } from "@opencode-ai/ui/icon"
import { Menu } from "@opencode-ai/ui/menu"
import { Button } from "@opencode-ai/ui/button"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { SettingsGeneral } from "./general/general"
import { SettingsAppearance } from "./appearance/appearance"
import { SettingsKeybinds } from "./keybinds/keybinds"
import { SettingsNotifications } from "./notifications/notifications"
import { SettingsProviders } from "./providers/providers"
import { SettingsModels } from "./models/models"
import { SettingsServers } from "./servers/servers"
import { SettingsWorkspaces } from "./workspaces/workspaces"
import { SettingsProjects } from "./workspaces/projects"
import { SettingsExtensions } from "./providers/extensions"
import { SettingsServerScope } from "./server-scope"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useLayout } from "@/shell/state/layout"
import { useTabs } from "@/shell/tabs/tabs"
import { useGlobal, useServerCtx } from "@/runtime/server/runtime"
import { getAppComposition, type SettingsTabEntry } from "@/composition"
import { groupSettingsTabs, type StockSettingsTab } from "./tabs"
import { ServerConnection, useServers } from "@/runtime/server/registry"
import { useCommand } from "@/shell/commands/command"
import { useSettingsSurface } from "./surface"
import { globalConfigPath } from "./config-path"
import { settingsVersionLines } from "./version"
import "@/settings/settings.css"

export const SettingsScreen: Component<{
  defaultValue?: string
}> = (props) => {
  const language = useLanguage()
  const platform = usePlatform()
  const dialog = useDialog()
  const command = useCommand()
  const surface = useSettingsSurface()
  const layout = useLayout()
  const servers = useServers()
  const tabs = useTabs()
  const global = useGlobal()
  const [tab, setTab] = createSignal(props.defaultValue ?? "general")
  let root: HTMLDivElement | undefined

  onMount(() => {
    command.keybinds(false)
    root?.focus({ preventScroll: true })
  })
  onCleanup(() => command.keybinds(true))

  createEffect(() => setTab(props.defaultValue ?? "general"))

  const server = createMemo(() => {
    const route = layout.route()
    switch (route.type) {
      case "draft": {
        const draft = tabs.store.find((item) => item.type === "draft" && item.draftID === route.draftID)
        return servers.list.find((item) => ServerConnection.key(item) === draft?.server)
      }
      case "session":
        return servers.list.find((item) => ServerConnection.key(item) === route.server)
      case "home":
        return servers.list.find((item) => ServerConnection.key(item) === layout.home.selection().server)
    }
  })
  const serverCtx = useServerCtx(server)

  createEffect(() => {
    const current = server()
    if (current) global.settings.server.set(ServerConnection.key(current))
  })

  const directory = createMemo(() => {
    const selected = global.settings.server.selected()
    const current = server()
    if (!selected || !current || ServerConnection.key(selected) !== ServerConnection.key(current)) return
    const route = layout.route()
    if (route.type === "draft") {
      const draft = tabs.store.find((item) => item.type === "draft" && item.draftID === route.draftID)
      return draft?.type === "draft" ? draft.directory : undefined
    }
    if (route.type === "session") return serverCtx()?.data.session.get(route.sessionId)?.location.directory
    return undefined
  })

  const showProviders = () => {
    dialog.close()
    setTab("providers")
  }

  const tabComposition = getAppComposition().settingsTabs
  const hiddenTabs = new Set(tabComposition?.hide ?? [])
  if (tabComposition?.extensions === "split") hiddenTabs.add("extensions")
  else {
    hiddenTabs.add("mcp")
    hiddenTabs.add("plugins")
    hiddenTabs.add("skills")
  }
  const addedTabs = tabComposition?.add ?? []
  const navGroups = groupSettingsTabs(addedTabs, hiddenTabs, tabComposition?.groups)
  const addedByValue = new Map(addedTabs.map((entry) => [entry.value, entry]))
  const [configEntries] = createResource(
    () => {
      if (!tabComposition?.showConfigPath) return
      const ctx = serverCtx()
      if (ctx?.sdk.connection.status() !== "connected") return
      return ctx
    },
    (ctx) => ctx.sdk.api.config.get(),
  )
  const configPath = createMemo(() => globalConfigPath(configEntries() ?? []))
  const stockTabs: Record<StockSettingsTab, { icon: IconProps["name"]; label: () => string }> = {
    general: { icon: "sliders", label: () => language.t("settings.tab.preferences") },
    appearance: { icon: "appearance", label: () => language.t("settings.general.section.appearance") },
    notifications: { icon: "notifications", label: () => language.t("settings.tab.notifications") },
    shortcuts: { icon: "keyboard", label: () => language.t("settings.tab.shortcuts") },
    servers: { icon: "server", label: () => language.t("status.popover.tab.servers") },
    projects: { icon: "folder", label: () => language.t("settings.tab.projects") },
    workspaces: { icon: "workspace-isolated", label: () => language.t("settings.tab.workspaces") },
    providers: { icon: "providers", label: () => language.t("settings.providers.title") },
    models: { icon: "models", label: () => language.t("settings.models.title") },
    extensions: { icon: "extensions", label: () => language.t("settings.tab.extensions") },
    mcp: { icon: "mcp", label: () => language.t("settings.extensions.tab.mcps") },
    plugins: { icon: "cube", label: () => language.t("status.popover.tab.plugins") },
    skills: { icon: "post-skill", label: () => language.t("settings.extensions.tab.skills") },
  }

  const tabDetails = (value: string) => {
    const entry = addedByValue.get(value)
    if (entry) return { value: entry.value, icon: entry.icon, label: entry.label }
    if (!(value in stockTabs)) return
    const stock = stockTabs[value as StockSettingsTab]
    return { value, icon: stock.icon, label: stock.label() }
  }

  const NavTab: Component<{ value: string }> = (tabProps) => {
    const item = tabDetails(tabProps.value)
    if (!item) return
    return (
      <Tabs.Trigger value={item.value}>
        <Icon name={item.icon} />
        {item.label}
      </Tabs.Trigger>
    )
  }

  return (
    <div
      ref={root}
      data-testid="settings-screen"
      class="settings-screen"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented || dialog.active) return
        event.preventDefault()
        surface.close()
      }}
    >
      <Tabs
        orientation="vertical"
        variant="settings"
        value={tab()}
        onChange={(value) => void startTransition(() => setTab(value))}
        class="settings"
      >
        <div class="settings-mobile-nav">
          <button type="button" class="settings-back" onClick={surface.close}>
            <Icon name="arrow-left" size="small" class="settings-back-icon" />
            <span>{language.t("settings.backToApp")}</span>
          </button>
          <Menu placement="bottom-end" gutter={8}>
            <Menu.Trigger as={Button} size="normal" variant="outline" class="settings-mobile-menu-trigger">
              <span>{tabDetails(tab())?.label ?? language.t("settings.tab.preferences")}</span>
              <Icon name="chevron-down" size="small" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content class="settings-mobile-menu" onEscapeKeyDown={(event) => event.stopPropagation()}>
                <Menu.RadioGroup value={tab()} onChange={(value) => void startTransition(() => setTab(value))}>
                  <For each={navGroups}>
                    {(group, index) => (
                      <>
                        <Show when={index() > 0}>
                          <Menu.Separator />
                        </Show>
                        <For each={group}>
                          {(value) => {
                            const item = tabDetails(value)
                            if (!item) return
                            return (
                              <Menu.RadioItem value={item.value} closeOnSelect>
                                <Icon name={item.icon} />
                                {item.label}
                              </Menu.RadioItem>
                            )
                          }}
                        </For>
                      </>
                    )}
                  </For>
                </Menu.RadioGroup>
              </Menu.Content>
            </Menu.Portal>
          </Menu>
        </div>
        <Tabs.List>
          <div class="settings-nav">
            <button type="button" class="settings-back" onClick={surface.close}>
              <Icon name="arrow-left" size="small" class="settings-back-icon" />
              <span>{language.t("settings.backToApp")}</span>
            </button>
            <div class="flex flex-col gap-4 w-full">
              <For each={navGroups}>
                {(group) => (
                  <div class="flex flex-col gap-1 w-full">
                    <For each={group}>{(value) => <NavTab value={value} />}</For>
                  </div>
                )}
              </For>
            </div>
          </div>
          <div class="settings-nav-footer">
            <Show when={configPath()}>
              {(path) => (
                <span class="settings-nav-config-path" title={path()}>
                  <bdi dir="ltr">{path()}</bdi>
                </span>
              )}
            </Show>
            <span>{language.t("app.name.desktop")}</span>
            <For each={settingsVersionLines({ productVersion: platform.productVersion, version: platform.version })}>
              {(line) => (
                <span title={line.title}>
                  <bdi dir="ltr">{line.text}</bdi>
                </span>
              )}
            </For>
          </div>
        </Tabs.List>

        <Tabs.Content value="general" class="settings-panel">
          <SettingsGeneral server={server()} />
        </Tabs.Content>
        <Tabs.Content value="appearance" class="settings-panel">
          <SettingsAppearance />
        </Tabs.Content>
        <Tabs.Content value="notifications" class="settings-panel">
          <SettingsNotifications />
        </Tabs.Content>
        <Tabs.Content value="shortcuts" class="settings-panel">
          <SettingsKeybinds />
        </Tabs.Content>
        <Show when={!hiddenTabs.has("servers")}>
          <Tabs.Content value="servers" class="settings-panel">
            <SettingsServers />
          </Tabs.Content>
        </Show>
        <Tabs.Content value="projects" class="settings-panel">
          <SettingsProjects />
        </Tabs.Content>
        <SettingsServerScope directory={directory()}>
          <Tabs.Content value="workspaces" class="settings-panel">
            <SettingsWorkspaces activeDirectory={directory()} />
          </Tabs.Content>
          <Tabs.Content value="providers" class="settings-panel">
            <Dynamic
              component={getAppComposition().settingsProviders ?? SettingsProviders}
              directory={directory()}
              onBack={showProviders}
            />
          </Tabs.Content>
          <Tabs.Content value="models" class="settings-panel">
            <SettingsModels />
          </Tabs.Content>
          <Show when={!hiddenTabs.has("extensions")}>
            <Tabs.Content value="extensions" class="settings-panel">
              <SettingsExtensions />
            </Tabs.Content>
          </Show>
          <Show when={!hiddenTabs.has("mcp")}>
            <Tabs.Content value="mcp" class="settings-panel">
              <SettingsExtensions view="mcps" />
            </Tabs.Content>
          </Show>
          <Show when={!hiddenTabs.has("plugins")}>
            <Tabs.Content value="plugins" class="settings-panel">
              <SettingsExtensions view="plugins" />
            </Tabs.Content>
          </Show>
          <Show when={!hiddenTabs.has("skills")}>
            <Tabs.Content value="skills" class="settings-panel">
              <SettingsExtensions view="skills" />
            </Tabs.Content>
          </Show>
        </SettingsServerScope>
        <For each={addedTabs}>
          {(entry) => (
            <Tabs.Content value={entry.value} class="settings-panel">
              <Dynamic component={entry.content} directory={directory()} onBack={showProviders} />
            </Tabs.Content>
          )}
        </For>
      </Tabs>
    </div>
  )
}
