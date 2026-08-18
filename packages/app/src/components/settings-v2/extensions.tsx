import { Component, For, createEffect, createMemo, createResource } from "solid-js"
import type { McpServer } from "@opencode-ai/client/promise"
import { Icon } from "@opencode-ai/ui/icon"
import { Switch } from "@opencode-ai/ui/switch"
import { Tabs } from "@opencode-ai/ui/tabs"
import { useLanguage } from "@/context/language"
import { useData } from "@/context/server"
import { useServerSDK } from "@/context/server-sdk"
import { useMcpToggle } from "@/context/mcp"
import { pluginLabel } from "@/utils/plugin"
import { ExternalLink } from "../external-link"
import { InlineServerSelect } from "./parts/server-select"
import "./settings-v2.css"

interface McpRowItem {
  name: string
  status: McpServer["status"]["status"]
}

interface PluginRowItem {
  name: string
}

export const SettingsExtensionsV2: Component = () => {
  const language = useLanguage()
  const serverSdk = useServerSDK()

  /**
   * MCP servers come from the *runtime* list, not from config — the same
   * correction the plugins list below already carries.
   *
   * `config.mcp` is `{ timeout?, servers? }`, so enumerating its entries
   * yielded rows named `servers` and `timeout` rather than server names, and
   * every server a user did not hand-write into an `opencode.json` — anything
   * the distribution ships — was missing entirely. `mcp.list()` reports what is
   * actually registered, which is what this tab exists to show.
   *
   * No location is passed: this is the server-wide view, a distinct scope from
   * any one project. Per-project state lives in project settings.
   */
  const [mcpServers, { refetch: refetchMcp }] = createResource(
    () => serverSdk.connection.status() === "connected",
    (connected) => {
      if (!connected) return []
      return serverSdk.api.mcp
        .list()
        .then((result) => result.data.map((server) => ({ name: server.name, status: server.status.status })))
        .catch(() => [])
    },
    { initialValue: [] },
  )
  const mcps = createMemo<McpRowItem[]>(() => [...mcpServers.latest].sort((a, b) => a.name.localeCompare(b.name)))
  const toggleMcp = useMcpToggle(() => undefined, refetchMcp)

  const [pluginList] = createResource(
    () => serverSdk.connection.status() === "connected",
    () => serverSdk.api.plugin.list().then((result) => result.data),
  )
  // Internal plugins are the ones OpenCode registers itself; they are not
  // extensions a user installed and have no meaning in this list.
  const plugins = createMemo<PluginRowItem[]>(() => {
    const loaded = (pluginList.latest ?? []).filter((item) => !String(item.id ?? "").startsWith("opencode."))
    return [...new Set(loaded.map(pluginLabel))].sort((a, b) => a.localeCompare(b)).map((name) => ({ name }))
  })

  const data = useData()
  createEffect(() => {
    if (serverSdk.connection.status() !== "connected") return
    void data.location.skill.sync().catch(() => undefined)
  })
  const skills = () => data.location.skill.list() ?? []

  return (
    <>
      <div class="settings-v2-tab-header">
        <div class="settings-v2-tab-header-row">
          <div class="flex flex-col gap-1">
            <h2 class="settings-v2-tab-title">{language.t("settings.tab.extensions")}</h2>
            <span class="text-11-regular text-v2-text-text-muted">{language.t("settings.extensions.description")}</span>
          </div>
          <InlineServerSelect />
        </div>
      </div>

      <div class="settings-v2-tab-body">
        <Tabs variant="pill" defaultValue="mcps" class="settings-v2-extensions-tabs">
          <Tabs.List>
            <Tabs.Trigger value="mcps">{language.t("settings.extensions.tab.mcps")}</Tabs.Trigger>
            <Tabs.Trigger value="plugins">{language.t("status.popover.tab.plugins")}</Tabs.Trigger>
            <Tabs.Trigger value="skills">{language.t("settings.extensions.tab.skills")}</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="mcps">
            <div class="settings-v2-section">
              <div class="flex items-center justify-between">
                <span class="text-13-medium text-v2-text-text-base">
                  {language.t("settings.extensions.availableAll")}
                </span>
                <span class="text-13-regular text-v2-text-faint">{language.t("settings.extensions.manageConfig")}</span>
              </div>
              <div class="bg-[var(--v2-background-bg-base)] border-[0.5px] border-[var(--v2-border-border-base)] rounded-[8px] pl-4 pr-3 overflow-hidden">
                <For each={mcps()}>
                  {(item) => (
                    <div class="py-4 flex items-center justify-between border-b-[0.5px] border-[var(--v2-border-border-base)] last:border-b-0">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <Icon name="mcp" class="text-v2-icon-icon-muted shrink-0" />
                        <span class="text-13-medium text-v2-text-text-base truncate">{item.name}</span>
                      </div>
                      <Switch
                        checked={item.status === "connected"}
                        disabled={item.status === "pending" || toggleMcp.isPending}
                        onChange={() => toggleMcp.mutate(item.name)}
                        hideLabel
                      >
                        {item.name}
                      </Switch>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="plugins">
            <div class="settings-v2-section">
              <div class="flex items-center justify-between">
                <span class="text-13-medium text-v2-text-text-base">
                  {language.t("settings.extensions.availableAll")}
                </span>
                <span class="text-13-regular text-v2-text-faint">{language.t("settings.extensions.manageConfig")}</span>
              </div>
              <div class="bg-[var(--v2-background-bg-base)] border-[0.5px] border-[var(--v2-border-border-base)] rounded-[8px] pl-4 pr-3 overflow-hidden">
                <For each={plugins()}>
                  {(plugin) => (
                    <div class="py-4 flex items-center justify-between border-b-[0.5px] border-[var(--v2-border-border-base)] last:border-b-0">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <Icon name="cube" class="text-v2-icon-icon-muted shrink-0" />
                        <span class="text-13-medium text-v2-text-text-base truncate font-mono">{plugin.name}</span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="skills">
            <div class="settings-v2-section">
              <div class="flex items-center justify-between">
                <span class="text-13-medium text-v2-text-text-base">
                  {language.t("settings.extensions.availableAll")}
                </span>
                <ExternalLink
                  class="text-13-regular text-v2-text-accent hover:underline"
                  href="https://opencode.ai/docs/skills/"
                >
                  {language.t("settings.extensions.addSkills")}
                </ExternalLink>
              </div>
              <div class="bg-[var(--v2-background-bg-base)] border-[0.5px] border-[var(--v2-border-border-base)] rounded-[8px] pl-4 pr-3 overflow-hidden">
                <For each={skills()}>
                  {(skill) => (
                    <div class="py-4 flex items-center justify-between border-b-[0.5px] border-[var(--v2-border-border-base)] last:border-b-0">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <Icon name="post-skill" class="text-v2-icon-icon-muted shrink-0" />
                        <span class="text-13-medium text-v2-text-text-base truncate">{skill.name}</span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Tabs.Content>
        </Tabs>
      </div>
    </>
  )
}
