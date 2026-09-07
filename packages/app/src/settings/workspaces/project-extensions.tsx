import { Icon } from "@opencode/ui/icon"
import { Switch } from "@opencode/ui/switch"
import { Tabs } from "@opencode/ui/tabs"
import { type Component, For, Show, createEffect, createMemo, createResource, createSignal, type JSX } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { useMcpToggle } from "@/providers/connect/mcp"
import { useWorkspaceLocation } from "@/workspaces/location"
import { useServerSDK } from "@/runtime/server/client"
import { useData } from "@/runtime/server/current"
import { pluginDisplayName, pluginLabel, pluginLabels } from "@/providers/catalog/plugin"
import { PluginOptionsEditor } from "@/settings/extensions/plugin-options-editor"
import { currentPlugin, hasPluginDetails } from "@/settings/extensions/plugin-options"
import type { PluginInfo } from "@opencode/client"
import { ExternalLink } from "@/runtime/platform/external-link"
import "@/settings/extensions/extensions.css"

type SkillItem = {
  name: string
  location: string
}

const skillKey = (item: SkillItem) => `${item.name}\n${item.location}`

const ExtensionCard: Component<{ children: JSX.Element }> = (props) => (
  <div class="project-settings-extension-card">{props.children}</div>
)

const ExtensionRow: Component<{
  icon: "mcp" | "puzzle-piece" | "post-skill"
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

const SharedSection: Component<{
  count: number
  children: JSX.Element
}> = (props) => {
  const language = useLanguage()
  const [open, setOpen] = createSignal(false)
  return (
    <Show when={props.count > 0}>
      <div class="project-settings-shared">
        <button
          type="button"
          class="project-settings-shared-trigger"
          aria-expanded={open()}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name="chevron-right" classList={{ "project-settings-shared-chevron": true, open: open() }} />
          <span>{language.t("project.settings.extensions.shared")}</span>
          <span class="project-settings-shared-count">{props.count}</span>
        </button>
        <Show when={open()}>
          <ExtensionCard>{props.children}</ExtensionCard>
        </Show>
      </div>
    </Show>
  )
}

export const ProjectSettingsExtensions: Component = () => {
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const directorySDK = useWorkspaceLocation()
  const data = useData()
  const toggleMcp = useMcpToggle(() => directorySDK().directory)

  createEffect(() => {
    if (serverSDK.connection.status() !== "connected") return
    const ref = { directory: directorySDK().directory }
    void Promise.all([
      data.location.mcp.server.sync(),
      data.location.skill.sync(),
      data.location.mcp.server.sync(ref),
      data.location.skill.sync(ref),
    ]).catch(() => undefined)
  })

  const globalMcpNames = createMemo(() =>
    [...new Set((data.location.mcp.server.list() ?? []).map((server) => server.name))].sort(),
  )
  const projectMcpNames = createMemo(() => {
    const shared = new Set(globalMcpNames())
    return (data.location.mcp.server.list({ directory: directorySDK().directory }) ?? [])
      .map((server) => server.name)
      .filter((name) => !shared.has(name))
      .sort()
  })
  const mcpEnabled = (name: string) =>
    data.location.mcp.server.list({ directory: directorySDK().directory })?.find((server) => server.name === name)
      ?.status.status === "connected"

  const [globalPluginList, { refetch: refetchGlobalPlugins }] = createResource(
    () => serverSDK.connection.status() === "connected",
    async () => {
      await serverSDK.api.plugin.awaitActivation()
      return serverSDK.api.plugin.list().then((result) => result.data)
    },
    { initialValue: [] as PluginInfo[] },
  )
  const [projectPluginList, { refetch: refetchProjectPlugins }] = createResource(
    () => (serverSDK.connection.status() === "connected" ? directorySDK().directory : undefined),
    async (directory) => {
      const location = { directory }
      await serverSDK.api.plugin.awaitActivation({ location })
      return serverSDK.api.plugin.list({ location }).then((result) => result.data)
    },
    { initialValue: [] as PluginInfo[] },
  )
  const globalPlugins = createMemo(() =>
    (globalPluginList.latest ?? []).filter((plugin) => plugin.source.type !== "builtin"),
  )
  const projectPlugins = createMemo(() => {
    const shared = new Set(pluginLabels(globalPlugins()))
    return (projectPluginList.latest ?? []).filter(
      (plugin) => plugin.source.type !== "builtin" && !shared.has(pluginLabel(plugin)),
    )
  })
  const [selectedPlugin, setSelectedPlugin] = createSignal<string>()
  const current = createMemo(() =>
    currentPlugin([...(projectPluginList.latest ?? []), ...(globalPluginList.latest ?? [])], selectedPlugin()),
  )
  const refetchPlugins = () => Promise.all([refetchGlobalPlugins(), refetchProjectPlugins()])

  const serverSkills = createMemo(() => data.location.skill.list() ?? [])
  const projectSkills = createMemo(() => {
    const shared = new Set(serverSkills().map(skillKey))
    return (data.location.skill.list({ directory: directorySDK().directory }) ?? []).filter(
      (item) => !shared.has(skillKey(item)),
    )
  })

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

  const pluginRows = (items: PluginInfo[]) => (
    <For each={items}>
      {(plugin) => (
        <Show
          when={hasPluginDetails(plugin)}
          fallback={<ExtensionRow icon="puzzle-piece" name={pluginDisplayName(plugin)} />}
        >
          <button type="button" class="plugin-options-open" onClick={() => setSelectedPlugin(String(plugin.id))}>
            <ExtensionRow icon="puzzle-piece" name={pluginDisplayName(plugin)}>
              <Icon name="chevron-right" size="small" />
            </ExtensionRow>
          </button>
        </Show>
      )}
    </For>
  )

  const skillRows = (items: SkillItem[]) => (
    <For each={items}>{(item) => <ExtensionRow icon="post-skill" name={item.name} />}</For>
  )

  return (
    <div class="project-settings-extensions">
      <div class="project-settings-page-header">
        <h2>{language.t("settings.tab.extensions")}</h2>
        <span>{language.t("project.settings.extensions.description")}</span>
      </div>

      <Tabs variant="pill" defaultValue="mcps" class="project-settings-extension-tabs">
        <Tabs.List>
          <Tabs.Trigger value="mcps">{language.t("settings.extensions.tab.mcps")}</Tabs.Trigger>
          <Tabs.Trigger value="plugins">{language.t("status.popover.tab.plugins")}</Tabs.Trigger>
          <Tabs.Trigger value="skills">{language.t("settings.extensions.tab.skills")}</Tabs.Trigger>
          {/* TODO: Restore LSP status when V2 exposes it. */}
        </Tabs.List>

        <Tabs.Content value="mcps">
          <div class="project-settings-extension-section">
            <div class="project-settings-extension-section-header">
              <span>{language.t("project.settings.extensions.added")}</span>
              <span>{language.t("settings.extensions.manageConfig")}</span>
            </div>
            <Show when={projectMcpNames().length > 0}>
              <ExtensionCard>{mcpRows(projectMcpNames())}</ExtensionCard>
            </Show>
            <SharedSection count={globalMcpNames().length}>{mcpRows(globalMcpNames())}</SharedSection>
          </div>
        </Tabs.Content>

        <Tabs.Content value="plugins">
          <div class="project-settings-extension-section">
            <Show
              when={current()}
              fallback={
                <>
                  <div class="project-settings-extension-section-header">
                    <span>{language.t("project.settings.extensions.added")}</span>
                    <span>{language.t("settings.extensions.manageConfig")}</span>
                  </div>
                  <Show when={projectPlugins().length > 0}>
                    <ExtensionCard>{pluginRows(projectPlugins())}</ExtensionCard>
                  </Show>
                  <SharedSection count={globalPlugins().length}>{pluginRows(globalPlugins())}</SharedSection>
                </>
              }
            >
              {(plugin) => (
                <PluginOptionsEditor
                  plugin={plugin()}
                  directory={directorySDK().directory}
                  onBack={() => setSelectedPlugin()}
                  onChanged={() => refetchPlugins()}
                />
              )}
            </Show>
          </div>
        </Tabs.Content>

        <Tabs.Content value="skills">
          <div class="project-settings-extension-section">
            <div class="project-settings-extension-section-header">
              <span>{language.t("project.settings.extensions.added")}</span>
              <ExternalLink class="project-settings-extension-link" href="https://opencode.ai/docs/skills/">
                {language.t("settings.extensions.addSkills")}
              </ExternalLink>
            </div>
            <Show when={projectSkills().length > 0}>
              <ExtensionCard>{skillRows(projectSkills())}</ExtensionCard>
            </Show>
            <SharedSection count={serverSkills().length}>{skillRows(serverSkills())}</SharedSection>
          </div>
        </Tabs.Content>
      </Tabs>
    </div>
  )
}
