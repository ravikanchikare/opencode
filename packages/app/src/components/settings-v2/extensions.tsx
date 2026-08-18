import { Component, For, createEffect, createMemo, createResource } from "solid-js"
import type { McpServer } from "@opencode-ai/client/promise"
import { Icon } from "@opencode-ai/ui/icon"
import { Switch } from "@opencode-ai/ui/v2/switch-v2"
import { TabsV2 } from "@opencode-ai/ui/v2/tabs-v2"
import { useLanguage } from "@/context/language"
import { useData } from "@/context/server"
import { authenticateMcp, connectMcp, disconnectMcp, toggleMcp } from "@/context/global-sync/mcp"
import { usePlatform } from "@/context/platform"
import { useServerSDK } from "@/context/server-sdk"
import { showToast } from "@/utils/toast"
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
  const platform = usePlatform()

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

  const handleMcpToggle = (item: McpRowItem) => {
    void toggleMcp({
      status: item.status,
      connect: () => connectMcp(serverSdk.api, item.name),
      disconnect: () => disconnectMcp(serverSdk.api, item.name),
      authenticate: () => authenticateMcp({ api: serverSdk.api, name: item.name, openExternal: platform.openExternal }),
      refresh: async () => {
        await refetchMcp()
      },
    }).catch((error) =>
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: error instanceof Error ? error.message : String(error),
      }),
    )
  }

  const [pluginList] = createResource(
    () => serverSdk.connection.status() === "connected",
    () => serverSdk.api.plugin.list().then((result) => result.data),
  )
  const plugins = createMemo<PluginRowItem[]>(() => {
    const loaded = (pluginList.latest ?? []).map((item) => String(item.id)).filter((id) => !id.startsWith("opencode."))
    return [...new Set([...loaded])]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name }))
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
        <TabsV2 variant="pill" defaultValue="mcps" class="settings-v2-extensions-tabs">
          <TabsV2.List>
            <TabsV2.Trigger value="mcps">{language.t("settings.extensions.tab.mcps")}</TabsV2.Trigger>
            <TabsV2.Trigger value="plugins">{language.t("status.popover.tab.plugins")}</TabsV2.Trigger>
            <TabsV2.Trigger value="skills">{language.t("settings.extensions.tab.skills")}</TabsV2.Trigger>
          </TabsV2.List>

          <TabsV2.Content value="mcps">
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
                        disabled={item.status === "pending"}
                        onChange={() => handleMcpToggle(item)}
                        hideLabel
                      >
                        {item.name}
                      </Switch>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </TabsV2.Content>

          <TabsV2.Content value="plugins">
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
          </TabsV2.Content>

          <TabsV2.Content value="skills">
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
          </TabsV2.Content>
        </TabsV2>
      </div>
    </>
  )
}
