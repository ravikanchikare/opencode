/**
 * The four extension destinations, as reusable panels.
 *
 * A composition that presents MCP, Plugins, Skills and Integrations as separate
 * Settings destinations registers them by name and supplies only navigation
 * metadata — label, icon, order. The behavior below is the host's: it is the
 * same data, the same toggles, and the same scope rules the combined Extensions
 * tab and the project dialog use, because all of them read `./data`.
 *
 * Every panel takes `directory`. `undefined` is server scope; a value is that
 * location. Nothing here reads an ambient location, so a panel cannot end up
 * scoped to a different server than the destination that rendered it.
 *
 * Nothing distribution-specific belongs in this file. A curated subset, a
 * product's own service list, or a policy about which extensions may be shown
 * is the composition's business, not the host's.
 */

import { createMemo, createResource, createSignal, Show, type Component } from "solid-js"
import { Switch } from "@opencode/ui/switch"
import { Button } from "@opencode/ui/button"
import { Icon } from "@opencode/ui/icon"
import { Spinner } from "@opencode/ui/spinner"
import { useIntegrations } from "@/providers/catalog/integrations"
import { useProviders } from "@/providers/catalog/providers"
import { useMcpToggle } from "@/providers/connect/mcp"
import { DialogConnectProvider, useProviderConnectController } from "@/providers/connect/dialog"
import { useLanguage } from "@/runtime/i18n/language"
import { useServerSDK } from "@/runtime/server/client"
import { useDialog } from "@opencode/ui/context/dialog"
import { SettingsServerScope } from "@/settings/server-scope"
import { InlineServerSelect } from "@/settings/server-select"
import { showToast } from "@/shell/notifications/toast"
import { useMcpServers, usePlugins } from "./data"
import { PluginOptionsEditor } from "./plugin-options-editor"
import { currentPlugin, hasPluginDetails } from "./plugin-options"
import { pluginDisplayName } from "@/providers/catalog/plugin"
import { currentSkill, detailOf, payloadFor, scopeOf } from "./skill-availability"
import { SkillDetails } from "./skill-details"
import { SkillAvailabilityControls } from "./skill-availability-controls"
import { createSkillInventory } from "./skill-inventory"
import {
  integrationSubtitle,
  serviceIntegrations,
  type IntegrationLike,
  type IntegrationRow,
} from "./integration-selection"
import { ExtensionDestination, ExtensionList, ExtensionRow } from "./shell"

export type ExtensionPanelProps = {
  directory: string | undefined
  onBack?: () => void
}

const locationOf = (directory: string | undefined) => (directory ? { directory } : undefined)

export const McpPanel: Component<ExtensionPanelProps> = (props) => {
  const servers = useMcpServers(() => props.directory)
  const toggle = useMcpToggle(() => props.directory, servers.refetch)

  return (
    <ExtensionDestination
      title="MCP"
      description="Model Context Protocol servers available to OpenCode at this location."
    >
      <ExtensionList each={servers.rows()} empty="No MCP servers are configured">
        {(item) => (
          <ExtensionRow icon="mcp" name={item.name} description={item.description}>
            <Switch
              checked={item.enabled}
              disabled={toggle.isPending && toggle.variables === item.id}
              hideLabel
              onChange={(checked) => {
                if (item.enabled === checked || toggle.isPending) return
                toggle.mutate(item.id)
              }}
            >
              {item.name}
            </Switch>
          </ExtensionRow>
        )}
      </ExtensionList>
    </ExtensionDestination>
  )
}

/**
 * Read-only, because the host has no plugin availability switch to drive. One
 * existed briefly and wrote rows nothing read, so a disabled plugin kept
 * running and the control flipped back on the next refetch. Gating plugin
 * *activation* is a real capability, and when the host grows one this panel is
 * where its control belongs.
 */
export const PluginsPanel: Component<ExtensionPanelProps> = (props) => {
  const language = useLanguage()
  const plugins = usePlugins(() => props.directory)
  const [selected, setSelected] = createSignal<string>()
  const current = createMemo(() => currentPlugin(plugins.rows(), selected()))

  return (
    <Show
      when={current()}
      fallback={
        <ExtensionDestination
          title="Plugins"
          description="Plugins loaded for this location, and any that failed to start."
        >
          <Show when={plugins.loading()}>
            <div class="extension-loading" role="status" aria-busy="true">
              <Spinner class="extension-loading-spinner" />
              {language.t("common.loading")}
            </div>
          </Show>
          <Show when={plugins.error() && !plugins.loading()}>
            <div class="extension-loading" role="alert">
              {language.t("settings.plugins.loadFailed")}
              <Button size="small" variant="ghost" onClick={() => void plugins.refetch()}>
                {language.t("settings.plugins.retry")}
              </Button>
            </div>
          </Show>
          <Show when={(!plugins.loading() && !plugins.error()) || plugins.rows().length > 0}>
            <ExtensionList each={plugins.rows()} empty={language.t("settings.plugins.none")}>
              {(plugin) => (
                <Show
                  when={hasPluginDetails(plugin)}
                  fallback={
                    <ExtensionRow
                      icon="puzzle-piece"
                      name={pluginDisplayName(plugin)}
                      mono={!plugin.name}
                      description={plugin.description}
                      detail={plugin.state.status === "failed" ? plugin.state.error : undefined}
                    />
                  }
                >
                  <button type="button" class="plugin-options-open" onClick={() => setSelected(String(plugin.id))}>
                    <ExtensionRow
                      icon="puzzle-piece"
                      name={pluginDisplayName(plugin)}
                      mono={!plugin.name}
                      description={plugin.description}
                      detail={plugin.state.status === "failed" ? plugin.state.error : undefined}
                    >
                      <Icon name="chevron-right" size="small" class="extension-destination-icon" />
                    </ExtensionRow>
                  </button>
                </Show>
              )}
            </ExtensionList>
          </Show>
        </ExtensionDestination>
      }
    >
      {(plugin) => (
        <div class="settings-tab-body extension-destination settings-detail-page">
          <PluginOptionsEditor
            plugin={plugin()}
            directory={props.directory}
            onBack={() => setSelected()}
            headerActions={<InlineServerSelect />}
            onChanged={() => plugins.refetch()}
          />
        </div>
      )}
    </Show>
  )
}

/**
 * The one destination with host-owned availability behind it. `enabled`,
 * `inherited` and `defaultEnabled` arrive resolved from `skill.inventory`; the
 * only decisions made here are about scope, and they live in
 * `./skill-availability` so they can be tested without a DOM.
 */
export const SkillsPanel: Component<ExtensionPanelProps> = (props) => {
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const [selected, setSelected] = createSignal<string>()
  const scope = createMemo(() => scopeOf(props.directory))

  const inventory = createSkillInventory({
    scope: () => (serverSDK.connection.status() === "connected" ? (props.directory ?? "@server") : false),
    load: async (key) => {
      const result = await serverSDK.api.skill.inventory({
        location: key === "@server" ? undefined : { directory: key },
      })
      return result.data
    },
    save: (key, item, enabled) =>
      serverSDK.api.skill.setEnabled({
        skill: item.id,
        location: key === "@server" ? undefined : { directory: key },
        payload: payloadFor(enabled, key === "@server" ? "default" : "location"),
      }),
    onError: (error, phase) => {
      showToast({
        variant: "error",
        title: language.t(`settings.skills.error.${phase}`),
        description: error instanceof Error ? error.message : String(error),
      })
    },
  })
  const current = createMemo(() => currentSkill(inventory.rows(), selected()))

  return (
    <Show
      when={current()}
      fallback={
        <ExtensionDestination
          title="Skills"
          description={
            scope() === "default"
              ? "Skills OpenCode may use. Switching one off here is the default for every project; a project can override it."
              : "Skills OpenCode may use in this project. A change here overrides the default for this project only."
          }
        >
          <ExtensionList each={inventory.rows()} empty="No skills are available">
            {(item) => (
              <ExtensionRow
                icon="post-skill"
                name={item.name}
                description={item.description}
                detail={detailOf(item, scope())}
                onOpen={() => setSelected(item.id)}
              >
                <SkillAvailabilityControls
                  skill={item}
                  scope={scope()}
                  pending={inventory.pending() !== undefined}
                  onChange={(enabled) => void inventory.set(item, enabled)}
                />
              </ExtensionRow>
            )}
          </ExtensionList>
        </ExtensionDestination>
      }
    >
      {(skill) => (
        <SkillDetails
          skill={skill()}
          scope={scope()}
          pending={inventory.pending() !== undefined}
          onEnabledChange={(enabled) => void inventory.set(skill(), enabled)}
          onBack={() => setSelected()}
        />
      )}
    </Show>
  )
}

export const IntegrationsPanel: Component<ExtensionPanelProps> = (props) => {
  const language = useLanguage()
  const dialog = useDialog()
  const serverSDK = useServerSDK()
  const integrations = useIntegrations(() => props.directory)
  const providers = useProviders(() => props.directory)
  const controller = useProviderConnectController({ onBack: props.onBack })

  const [mcpOwned] = createResource(
    () => serverSDK.connection.status() === "connected",
    () =>
      serverSDK.api.mcp
        .list()
        .then((result) =>
          result.data.map((entry) => entry.integrationID).filter((id): id is string => id !== undefined),
        )
        .catch(() => [] as string[]),
    { initialValue: [] as string[] },
  )

  const [websearch] = createResource(
    // Include the directory so a scope change refetches rather than serving the
    // previous location's providers.
    () => (serverSDK.connection.status() === "connected" ? (props.directory ?? "@server") : false),
    () =>
      serverSDK.api.websearch
        .providers({ location: locationOf(props.directory) })
        .then((result) => result.data.map((entry) => String(entry.id)))
        .catch(() => [] as string[]),
    { initialValue: [] as string[] },
  )

  const rows = createMemo(() =>
    serviceIntegrations({
      integrations: integrations.list() as readonly IntegrationLike[],
      websearchIDs: websearch.latest,
      mcpOwnedIDs: mcpOwned.latest,
      availableProviderIDs: [...(providers.all() as Map<string, unknown>).keys()],
    }),
  )

  const connect = (id: string) => {
    controller.select(id)
    void dialog.show(() => (
      <SettingsServerScope directory={props.directory}>
        <DialogConnectProvider directory={props.directory} controller={controller} />
      </SettingsServerScope>
    ))
  }

  const disconnect = async (item: IntegrationRow) => {
    const location = locationOf(props.directory)
    await serverSDK.api.integration
      .get({ integrationID: item.id, location })
      .then(async (result) => {
        const credentials = result.data?.connections.filter((entry) => entry.type === "credential") ?? []
        if (credentials.length === 0) throw new Error(`No removable credentials found for ${item.name}`)
        await Promise.all(
          credentials.map((credential) => serverSDK.api.credential.remove({ credentialID: credential.id, location })),
        )
        showToast({
          variant: "success",
          icon: "circle-check",
          title: language.t("provider.disconnect.toast.disconnected.title", { provider: item.name }),
          description: language.t("provider.disconnect.toast.disconnected.description", { provider: item.name }),
        })
      })
      .catch((error: unknown) =>
        showToast({
          variant: "error",
          title: language.t("common.requestFailed"),
          description: error instanceof Error ? error.message : String(error),
        }),
      )
  }

  return (
    <ExtensionDestination
      title="Integrations"
      description="Credentialed connections to external services. MCP servers have their own destination."
    >
      <ExtensionList each={rows()} empty="No service integrations are available">
        {(item) => (
          <ExtensionRow icon="plug" name={item.name} detail={integrationSubtitle(item)}>
            <Show
              when={item.connected}
              fallback={
                <Show
                  when={item.connectable}
                  fallback={<span class="extension-destination-status">Not connected</span>}
                >
                  <Button size="normal" variant="neutral" icon="plus" onClick={() => connect(item.id)}>
                    {language.t("common.connect")}
                  </Button>
                </Show>
              }
            >
              <Show
                when={item.viaCredential}
                fallback={
                  <span class="extension-destination-status" data-connected="true">
                    Connected
                  </span>
                }
              >
                <Button size="normal" variant="neutral" onClick={() => void disconnect(item)}>
                  {language.t("common.disconnect")}
                </Button>
              </Show>
            </Show>
          </ExtensionRow>
        )}
      </ExtensionList>
    </ExtensionDestination>
  )
}

/** The panels a composition may name instead of supplying its own component. */
export const EXTENSION_PANELS = {
  mcp: McpPanel,
  plugins: PluginsPanel,
  skills: SkillsPanel,
  integrations: IntegrationsPanel,
} as const

export type ExtensionPanelName = keyof typeof EXTENSION_PANELS

/** Re-exported so a composition can build a bespoke panel from the same rows. */
export { ExtensionDestination, ExtensionList, ExtensionRow } from "./shell"
export { integrationAuthLabel, integrationSubtitle, serviceIntegrations } from "./integration-selection"
