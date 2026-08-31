import { Component, For, Show, createMemo, createResource } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { Switch } from "@opencode-ai/ui/switch"
import { Tabs } from "@opencode-ai/ui/tabs"
import { useLanguage } from "@/runtime/i18n/language"
import { useServerSDK } from "@/runtime/server/client"
import { useMcpToggle } from "@/providers/connect/mcp"
import { InlineServerSelect } from "@/settings/server-select"
import { pluginRows } from "@/settings/extension-inventory"
import { createExtensionToggle } from "@/settings/extension-toggle"
import { showToast } from "@/shell/notifications/toast"
import "@/settings/settings.css"

interface McpRowItem {
  name: string
  enabled: boolean
}

type ExtensionView = "mcps" | "plugins" | "skills"

export const SettingsExtensions: Component<{ view?: ExtensionView }> = (props) => {
  const language = useLanguage()
  const serverSdk = useServerSDK()
  const notifyError = (error: unknown) =>
    showToast({
      title: language.t("common.requestFailed"),
      description: error instanceof Error ? error.message : String(error),
    })
  const [mcpList, { refetch: refetchMcp }] = createResource(
    () => serverSdk.connection.status() === "connected",
    () => serverSdk.api.mcp.list().then((result) => result.data),
    { initialValue: [] },
  )
  const toggleMcp = useMcpToggle(() => undefined, refetchMcp)
  const mcps = createMemo<McpRowItem[]>(() => {
    return (mcpList.latest ?? []).map((server) => ({
      name: server.name,
      enabled: server.status.status === "connected",
    }))
  })

  const handleMcpToggle = (item: McpRowItem, checked: boolean) => {
    if (item.enabled === checked || toggleMcp.isPending) return
    toggleMcp.mutate(item.name)
  }

  const [pluginList, { refetch: refetchPlugins }] = createResource(
    () => serverSdk.connection.status() === "connected",
    () => serverSdk.api.plugin.list().then((result) => result.data),
    { initialValue: [] },
  )
  const plugins = createMemo(() => pluginRows(pluginList.latest ?? []))
  const pluginToggle = createExtensionToggle({
    mutate: (plugin, enabled) =>
      serverSdk.api.plugin.setEnabled({
        plugin,
        payload: { enabled: enabled ?? true },
      }),
    refresh: refetchPlugins,
    onError: notifyError,
  })

  const [skills, { refetch: refetchSkills }] = createResource(
    () => serverSdk.connection.status() === "connected",
    () => serverSdk.api.skill.inventory().then((result) => result.data),
    { initialValue: [] },
  )
  const skillToggle = createExtensionToggle({
    mutate: (skill, enabled) =>
      serverSdk.api.skill.setEnabled({
        skill,
        payload: { enabled: enabled ?? true },
      }),
    refresh: refetchSkills,
    onError: notifyError,
  })

  const McpContent: Component = () => (
    <div class="settings-section">
      <span class="text-13-medium text-v2-text-text-base">{language.t("settings.extensions.availableAll")}</span>
      <div class="bg-[var(--v2-background-bg-base)] border-[0.5px] border-[var(--v2-border-border-base)] rounded-[8px] pl-4 pr-3 overflow-hidden">
        <For each={mcps()}>
          {(item) => (
            <div class="py-4 flex items-center justify-between border-b-[0.5px] border-[var(--v2-border-border-base)] last:border-b-0">
              <div class="flex items-center gap-2.5 min-w-0">
                <Icon name="mcp" class="text-v2-icon-icon-muted shrink-0" />
                <span class="text-13-medium text-v2-text-text-base truncate">{item.name}</span>
              </div>
              <Switch checked={item.enabled} onChange={(checked) => handleMcpToggle(item, checked)} hideLabel>
                {item.name}
              </Switch>
            </div>
          )}
        </For>
      </div>
    </div>
  )

  const PluginContent: Component = () => (
    <div class="settings-section">
      <span class="text-13-medium text-v2-text-text-base">{language.t("settings.extensions.availableAll")}</span>
      <div class="bg-[var(--v2-background-bg-base)] border-[0.5px] border-[var(--v2-border-border-base)] rounded-[8px] pl-4 pr-3 overflow-hidden">
        <For each={plugins()}>
          {(plugin) => (
            <div class="py-4 flex items-center justify-between border-b-[0.5px] border-[var(--v2-border-border-base)] last:border-b-0">
              <div class="flex items-center gap-2.5 min-w-0">
                <Icon name="cube" class="text-v2-icon-icon-muted shrink-0" />
                <span class="text-13-medium text-v2-text-text-base truncate font-mono">{plugin.name}</span>
              </div>
              <Show when={plugin.toggleable && plugin.id}>
                {(id) => (
                  <Switch
                    checked={plugin.enabled}
                    disabled={pluginToggle.pending(id())}
                    onChange={(enabled) => {
                      if (enabled === plugin.enabled) return
                      void pluginToggle.run(id(), enabled)
                    }}
                    hideLabel
                  >
                    {plugin.name}
                  </Switch>
                )}
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  )

  const SkillContent: Component = () => (
    <div class="settings-section">
      <span class="text-13-medium text-v2-text-text-base">{language.t("settings.extensions.availableAll")}</span>
      <div class="bg-[var(--v2-background-bg-base)] border-[0.5px] border-[var(--v2-border-border-base)] rounded-[8px] pl-4 pr-3 overflow-hidden">
        <For each={skills()}>
          {(skill) => (
            <div class="py-4 flex items-center justify-between border-b-[0.5px] border-[var(--v2-border-border-base)] last:border-b-0">
              <div class="flex items-center gap-2.5 min-w-0">
                <Icon name="post-skill" class="text-v2-icon-icon-muted shrink-0" />
                <span class="text-13-medium text-v2-text-text-base truncate">{skill.name}</span>
              </div>
              <Switch
                checked={skill.enabled}
                disabled={skillToggle.pending(skill.id)}
                onChange={(enabled) => {
                  if (enabled === skill.enabled) return
                  void skillToggle.run(skill.id, enabled)
                }}
                hideLabel
              >
                {skill.name}
              </Switch>
            </div>
          )}
        </For>
      </div>
    </div>
  )

  const content = (view: ExtensionView) => {
    if (view === "mcps") return <McpContent />
    if (view === "plugins") return <PluginContent />
    return <SkillContent />
  }
  const title = () => {
    if (props.view === "mcps") return language.t("settings.extensions.tab.mcps")
    if (props.view === "plugins") return language.t("status.popover.tab.plugins")
    if (props.view === "skills") return language.t("settings.extensions.tab.skills")
    return language.t("settings.tab.extensions")
  }

  return (
    <>
      <div class="settings-tab-header">
        <div class="settings-tab-header-row">
          <div class="flex flex-col gap-1">
            <h2 class="settings-tab-title">{title()}</h2>
            <span class="text-11-regular text-v2-text-text-muted">{language.t("settings.extensions.description")}</span>
          </div>
          <InlineServerSelect />
        </div>
      </div>

      <div class="settings-tab-body">
        {props.view ? (
          content(props.view)
        ) : (
          <Tabs variant="pill" defaultValue="mcps" class="settings-extensions-tabs">
            <Tabs.List>
              <Tabs.Trigger value="mcps">{language.t("settings.extensions.tab.mcps")}</Tabs.Trigger>
              <Tabs.Trigger value="plugins">{language.t("status.popover.tab.plugins")}</Tabs.Trigger>
              <Tabs.Trigger value="skills">{language.t("settings.extensions.tab.skills")}</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="mcps">
              <McpContent />
            </Tabs.Content>

            <Tabs.Content value="plugins">
              <PluginContent />
            </Tabs.Content>

            <Tabs.Content value="skills">
              <SkillContent />
            </Tabs.Content>
          </Tabs>
        )}
      </div>
    </>
  )
}
