import { Icon } from "@opencode-ai/ui/icon"
import { Switch } from "@opencode-ai/ui/switch"
import { Tabs } from "@opencode-ai/ui/tabs"
import type { SkillInventory } from "@opencode-ai/client"
import { type Component, For, Show, createEffect, createMemo, createResource, type JSX } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { useMcpToggle } from "@/providers/connect/mcp"
import { useWorkspaceLocation } from "@/workspaces/location"
import { useServerSDK } from "@/runtime/server/client"
import { useData } from "@/runtime/server/current"
import { pluginRows, type PluginRow } from "@/settings/extension-inventory"
import { createExtensionToggle } from "@/settings/extension-toggle"
import { showToast } from "@/shell/notifications/toast"

export type ProjectExtensionView = "mcps" | "plugins" | "skills"

const ExtensionCard: Component<{ children: JSX.Element }> = (props) => (
  <div class="project-settings-extension-card">{props.children}</div>
)

const ExtensionRow: Component<{
  icon: "mcp" | "cube" | "post-skill"
  name: string
  children?: JSX.Element
}> = (props) => (
  <div class="project-settings-extension-row">
    <div class="project-settings-extension-row-main">
      <Icon name={props.icon} class="project-settings-extension-row-icon" />
      <span class="project-settings-extension-row-name">{props.name}</span>
    </div>
    {props.children}
  </div>
)

export const ProjectSettingsExtensions: Component<{ view?: ProjectExtensionView }> = (props) => {
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const directorySDK = useWorkspaceLocation()
  const data = useData()
  const toggleMcp = useMcpToggle(() => directorySDK().directory)
  const notifyError = (error: unknown) =>
    showToast({
      title: language.t("common.requestFailed"),
      description: error instanceof Error ? error.message : String(error),
    })

  createEffect(() => {
    if (serverSDK.connection.status() !== "connected") return
    const ref = { directory: directorySDK().directory }
    void Promise.all([data.location.mcp.server.sync(), data.location.mcp.server.sync(ref)]).catch(() => undefined)
  })

  const globalMcpNames = createMemo(() =>
    [...new Set((data.location.mcp.server.list() ?? []).map((server) => server.name))].sort(),
  )
  const projectMcpNames = createMemo(() =>
    [
      ...new Set([
        ...globalMcpNames(),
        ...(data.location.mcp.server.list({ directory: directorySDK().directory }) ?? []).map((server) => server.name),
      ]),
    ].sort(),
  )
  const mcpEnabled = (name: string) =>
    data.location.mcp.server.list({ directory: directorySDK().directory })?.find((server) => server.name === name)
      ?.status.status === "connected"

  const [projectPluginList, { refetch: refetchProjectPlugins }] = createResource(
    () => (serverSDK.connection.status() === "connected" ? directorySDK().directory : undefined),
    (directory) => serverSDK.api.plugin.list({ location: { directory } }).then((result) => result.data),
    { initialValue: [] },
  )
  const plugins = createMemo(() => pluginRows(projectPluginList.latest ?? []))
  const pluginToggle = createExtensionToggle({
    mutate: (plugin, enabled) =>
      serverSDK.api.plugin.setEnabled({
        plugin,
        location: { directory: directorySDK().directory },
        payload: enabled === undefined ? { inherit: true } : { enabled },
      }),
    refresh: refetchProjectPlugins,
    onError: notifyError,
  })

  const [projectSkillList, { refetch: refetchProjectSkills }] = createResource(
    () => (serverSDK.connection.status() === "connected" ? directorySDK().directory : undefined),
    (directory) => serverSDK.api.skill.inventory({ location: { directory } }).then((result) => result.data),
    { initialValue: [] },
  )
  const skills = createMemo(() => projectSkillList.latest ?? [])
  const skillToggle = createExtensionToggle({
    mutate: (skill, enabled) =>
      serverSDK.api.skill.setEnabled({
        skill,
        location: { directory: directorySDK().directory },
        payload: enabled === undefined ? { inherit: true } : { enabled },
      }),
    refresh: refetchProjectSkills,
    onError: notifyError,
  })

  const InheritedToggle: Component<{
    name: string
    enabled: boolean
    inherited: boolean
    defaultEnabled: boolean
    pending: boolean
    onChange: (enabled?: boolean) => void
  }> = (item) => (
    <div class="project-settings-extension-row-status">
      <Show
        when={!item.inherited}
        fallback={
          <span>
            {item.defaultEnabled
              ? language.t("project.settings.extensions.defaultOn")
              : language.t("project.settings.extensions.defaultOff")}
          </span>
        }
      >
        <button
          type="button"
          class="project-settings-extension-default"
          disabled={item.pending}
          onClick={() => item.onChange()}
        >
          {language.t("project.settings.extensions.useDefault")}
        </button>
      </Show>
      <Switch
        checked={item.enabled}
        disabled={item.pending}
        hideLabel
        onChange={(enabled) => {
          if (enabled === item.enabled) return
          item.onChange(enabled)
        }}
      >
        {item.name}
      </Switch>
    </div>
  )

  const mcpRows = (items: string[]) => (
    <For each={items}>
      {(name) => (
        <ExtensionRow icon="mcp" name={name}>
          <Switch
            checked={mcpEnabled(name)}
            disabled={toggleMcp.isPending && toggleMcp.variables === name}
            hideLabel
            onChange={() => {
              if (toggleMcp.isPending) return
              toggleMcp.mutate(name)
            }}
          >
            {name}
          </Switch>
        </ExtensionRow>
      )}
    </For>
  )

  const renderPluginRows = (items: PluginRow[]) => (
    <For each={items}>
      {(item) => (
        <ExtensionRow icon="cube" name={item.name}>
          <Show when={item.toggleable && item.id}>
            {(id) => (
              <InheritedToggle
                name={item.name}
                enabled={item.enabled}
                inherited={item.inherited}
                defaultEnabled={item.defaultEnabled}
                pending={pluginToggle.pending(id())}
                onChange={(enabled) => void pluginToggle.run(id(), enabled)}
              />
            )}
          </Show>
        </ExtensionRow>
      )}
    </For>
  )

  const skillRows = (items: SkillInventory[]) => (
    <For each={items}>
      {(item) => (
        <ExtensionRow icon="post-skill" name={item.name}>
          <InheritedToggle
            name={item.name}
            enabled={item.enabled}
            inherited={item.inherited}
            defaultEnabled={item.defaultEnabled}
            pending={skillToggle.pending(item.id)}
            onChange={(enabled) => void skillToggle.run(item.id, enabled)}
          />
        </ExtensionRow>
      )}
    </For>
  )

  const McpContent: Component = () => (
    <div class="project-settings-extension-section">
      <div class="project-settings-extension-section-header">
        <span>{language.t("project.settings.extensions.added")}</span>
      </div>
      <Show when={projectMcpNames().length > 0}>
        <ExtensionCard>{mcpRows(projectMcpNames())}</ExtensionCard>
      </Show>
    </div>
  )

  const PluginContent: Component = () => (
    <div class="project-settings-extension-section">
      <div class="project-settings-extension-section-header">
        <span>{language.t("project.settings.extensions.added")}</span>
      </div>
      <Show when={plugins().length > 0}>
        <ExtensionCard>{renderPluginRows(plugins())}</ExtensionCard>
      </Show>
    </div>
  )

  const SkillContent: Component = () => (
    <div class="project-settings-extension-section">
      <div class="project-settings-extension-section-header">
        <span>{language.t("project.settings.extensions.added")}</span>
      </div>
      <Show when={skills().length > 0}>
        <ExtensionCard>{skillRows(skills())}</ExtensionCard>
      </Show>
    </div>
  )

  const content = (view: ProjectExtensionView) => {
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
    <div class="project-settings-extensions">
      <div class="project-settings-page-header">
        <h2>{title()}</h2>
        <span>{language.t("project.settings.extensions.description")}</span>
      </div>

      {props.view ? (
        content(props.view)
      ) : (
        <Tabs variant="pill" defaultValue="mcps" class="project-settings-extension-tabs">
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
  )
}
