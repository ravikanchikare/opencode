import { For, Show, createMemo, onCleanup, type Component, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { Key } from "@solid-primitives/keyed"
import { Button } from "@opencode/ui/button"
import { Switch } from "@opencode/ui/switch"
import { Collapsible } from "@opencode/ui/collapsible"
import { Icon } from "@opencode/ui/icon"
import { TextInput } from "@opencode/ui/text-input"
import type { PluginInfo, PluginOptionChoice } from "@opencode/client"
import { useServerSDK } from "@/runtime/server/client"
import { useLanguage } from "@/runtime/i18n/language"
import { pluginDisplayName } from "@/providers/catalog/plugin"
import { showToast } from "@/shell/notifications/toast"
import { SettingsList } from "@/settings/list"
import { canReset, editorValues, isSelectionActive, optionLabel, scopeOf } from "./plugin-options"
import { filterPluginChoices, groupPluginChoices } from "./plugin-catalog"
import "./extensions.css"

export const PluginOptionsEditor: Component<{
  plugin: PluginInfo
  directory: string | undefined
  onBack?: () => void
  headerActions?: JSX.Element
  onChanged?: () => unknown | Promise<unknown>
}> = (props) => {
  const serverSDK = useServerSDK()
  const language = useLanguage()
  const [store, setStore] = createStore({ pending: "", query: "", expanded: {} as Record<string, boolean> })
  const scope = () => scopeOf(props.directory)
  const pluginId = () => String(props.plugin.id ?? "")
  const location = () => (props.directory ? { directory: props.directory } : undefined)
  const descriptors = () => props.plugin.options?.descriptors ?? []

  // File-watcher activation can finish after the save response and its first refresh.
  onCleanup(
    serverSDK.event.on("plugin.updated", (event) => {
      if (props.directory && event.location?.directory !== props.directory) return
      void Promise.resolve(props.onChanged?.()).catch((error) => {
        showToast({
          variant: "error",
          title: language.t("settings.plugins.refreshFailed"),
          description: error instanceof Error ? error.message : String(error),
        })
      })
    }),
  )

  const save = async (key: string, value: readonly string[] | undefined) => {
    if (!pluginId() || store.pending) return
    const focus = document.activeElement
    setStore("pending", key)
    try {
      await serverSDK.api.plugin.setOptions({
        plugin: pluginId(),
        location: location(),
        payload: value === undefined ? { key, inherit: true as const } : { key, value: [...value] },
      })
      // Keep controls locked through the authoritative inventory refresh.
      await props.onChanged?.()
    } catch (error) {
      showToast({
        variant: "error",
        title: language.t("settings.plugins.saveFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setStore("pending", "")
      if (focus instanceof HTMLElement && focus.isConnected && document.activeElement === document.body) focus.focus()
    }
  }

  const saveAll = async (mode: "all" | "none" | "default") => {
    if (!pluginId() || store.pending) return
    const focus = document.activeElement
    setStore("pending", "*")
    try {
      for (const descriptor of descriptors()) {
        const value =
          mode === "default" ? undefined : mode === "all" ? descriptor.choices.map((choice) => choice.value) : []
        await serverSDK.api.plugin.setOptions({
          plugin: pluginId(),
          location: location(),
          payload:
            value === undefined ? { key: descriptor.key, inherit: true as const } : { key: descriptor.key, value },
        })
      }
      await props.onChanged?.()
    } catch (error) {
      showToast({
        variant: "error",
        title: language.t("settings.plugins.saveFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setStore("pending", "")
      if (focus instanceof HTMLElement && focus.isConnected && document.activeElement === document.body) focus.focus()
    }
  }

  return (
    <div class="plugin-options">
      <Show when={props.onBack || props.headerActions}>
        <div class="plugin-details-toolbar">
          <Show when={props.onBack}>
            <Button size="small" variant="ghost" class="plugin-details-back" onClick={() => props.onBack?.()}>
              <Icon name="arrow-left" size="small" />
              {language.t("settings.plugins.back")}
            </Button>
          </Show>
          {props.headerActions}
        </div>
      </Show>
      <header class="plugin-details-heading">
        <div class="plugin-details-toolbar plugin-details-title-row">
          <h2 class="settings-tab-title">{pluginDisplayName(props.plugin)}</h2>
          <Show when={descriptors().length}>
            <div class="plugin-details-actions">
              <Button
                size="small"
                variant="ghost"
                disabled={!!store.pending || !pluginId()}
                onClick={() => void saveAll("all")}
              >
                {language.t("settings.plugins.selectAll")}
              </Button>
              <Button
                size="small"
                variant="ghost"
                disabled={!!store.pending || !pluginId()}
                onClick={() => void saveAll("none")}
              >
                {language.t("settings.plugins.clearAll")}
              </Button>
              <Show when={canReset(props.plugin.options?.inherited ?? true, scope())}>
                <Button
                  size="small"
                  variant="ghost"
                  disabled={!!store.pending || !pluginId()}
                  onClick={() => void saveAll("default")}
                >
                  {language.t("settings.plugins.reset")}
                </Button>
              </Show>
            </div>
          </Show>
        </div>
        <Show when={props.plugin.description}>
          <p class="plugin-details-description">{props.plugin.description}</p>
        </Show>
      </header>
      <Show when={props.plugin.state.status === "failed" ? props.plugin.state.error : undefined}>
        {(error) => (
          <p role="alert" class="plugin-details-error">
            {String(error())}
          </p>
        )}
      </Show>
      <Show when={!props.plugin.options?.descriptors.length}>
        <p class="plugin-details-description">{language.t("settings.plugins.noOptions")}</p>
      </Show>
      <Key each={descriptors()} by="key">
        {(descriptor) => {
          const selected = createMemo(
            () => new Set(editorValues(props.plugin, descriptor().key, descriptor().default ?? [])),
          )
          const rows = createMemo(() => filterPluginChoices(descriptor().choices, store.query))
          const grouped = createMemo(() => groupPluginChoices(descriptor().choices, store.query))
          const toggle = (choice: PluginOptionChoice, label = choice.label) => (
            <Switch
              checked={selected().has(choice.value)}
              hideLabel
              disabled={!!store.pending || !pluginId()}
              onChange={(checked) => {
                const next = new Set(selected())
                if (checked) next.add(choice.value)
                else next.delete(choice.value)
                void save(descriptor().key, [...next])
              }}
            >
              {label}
            </Switch>
          )
          return (
            <section
              class="plugin-options-field"
              aria-label={optionLabel(pluginId(), descriptor().key, descriptor().label)}
            >
              <div
                class="plugin-search-row"
                classList={{ grouped: grouped().columns.length > 0 }}
                style={{ "--plugin-columns": grouped().columns.length }}
              >
                <TextInput
                  type="search"
                  appearance="base"
                  value={store.query}
                  onInput={(event) => setStore("query", event.currentTarget.value)}
                  placeholder={language.t("settings.plugins.search")}
                  aria-label={language.t("settings.plugins.search")}
                />
                <For each={grouped().columns}>{(column) => <span>{column}</span>}</For>
              </div>
              <Show when={store.pending === descriptor().key || !isSelectionActive(props.plugin, descriptor().key)}>
                <div role="status" aria-live="polite" class="plugin-details-description">
                  {language.t(
                    store.pending === descriptor().key ? "settings.plugins.applying" : "settings.plugins.notActive",
                  )}
                </div>
              </Show>
              <Show
                when={rows().length}
                fallback={<p class="plugin-details-description">{language.t("settings.plugins.empty")}</p>}
              >
                <SettingsList>
                  <Key each={grouped().rows} by="id">
                    {(group) => {
                      const key = () => `${descriptor().key}:${group().id}`
                      return (
                        <Collapsible
                          class="plugin-domain"
                          variant="ghost"
                          open={!!store.query.trim() || !!store.expanded[key()]}
                          onOpenChange={(open) => setStore("expanded", key(), open)}
                        >
                          <div class="plugin-control-columns" style={{ "--plugin-columns": grouped().columns.length }}>
                            <Collapsible.Trigger class="plugin-domain-trigger" disabled={!!store.query.trim()}>
                              <Collapsible.Arrow />
                              <span class="plugin-domain-label">{group().label}</span>
                            </Collapsible.Trigger>
                            <For each={grouped().columns}>
                              {(column) => (
                                <div class="plugin-control-cell">
                                  <Show
                                    when={group().choices.find((choice) => choice.label === column)}
                                    fallback={<span>—</span>}
                                  >
                                    {(choice) => toggle(choice(), `${group().label}: ${column}`)}
                                  </Show>
                                </div>
                              )}
                            </For>
                          </div>
                          <Show when={group().description}>
                            <p class="plugin-details-description">{group().description}</p>
                          </Show>
                          <Collapsible.Content>
                            <div class="plugin-domain-tools">
                              <For each={group().choices}>
                                {(choice) => (
                                  <For each={grouped().matched.get(choice.value) ?? []}>
                                    {(tool) => (
                                      <div class="plugin-operation" data-enabled={selected().has(choice.value)}>
                                        <code>{tool.name}</code>
                                        <p class="plugin-details-description">{tool.description}</p>
                                        <PluginInputSchema name={tool.name} input={tool.input} />
                                      </div>
                                    )}
                                  </For>
                                )}
                              </For>
                            </div>
                          </Collapsible.Content>
                        </Collapsible>
                      )
                    }}
                  </Key>
                  <Key each={rows().filter((row) => !row.choice.group)} by={(row) => row.choice.value}>
                    {(row) => {
                      const flat = () =>
                        row().choice.tools?.length === 1 && row().choice.tools?.[0]?.name === row().choice.value
                      const key = () => `${descriptor().key}:${row().choice.value}`
                      return (
                        <Show
                          when={flat()}
                          fallback={
                            <Collapsible
                              class="plugin-domain"
                              variant="ghost"
                              open={!!store.query.trim() || !!store.expanded[key()]}
                              onOpenChange={(open) => setStore("expanded", key(), open)}
                            >
                              <div class="plugin-domain-row">
                                <Show
                                  when={row().choice.tools?.length}
                                  fallback={<span class="plugin-domain-label">{row().choice.label}</span>}
                                >
                                  <Collapsible.Trigger class="plugin-domain-trigger" disabled={!!store.query.trim()}>
                                    <Collapsible.Arrow />
                                    <span class="plugin-domain-label">{row().choice.label}</span>
                                  </Collapsible.Trigger>
                                </Show>
                                {toggle(row().choice)}
                              </div>
                              <Show when={row().choice.description}>
                                <p class="plugin-details-description">{row().choice.description}</p>
                              </Show>
                              <Collapsible.Content>
                                <div class="plugin-domain-tools">
                                  <For each={row().tools}>
                                    {(tool) => (
                                      <div class="plugin-operation">
                                        <code>{tool.name}</code>
                                        <p class="plugin-details-description">{tool.description}</p>
                                        <PluginInputSchema name={tool.name} input={tool.input} />
                                      </div>
                                    )}
                                  </For>
                                </div>
                              </Collapsible.Content>
                            </Collapsible>
                          }
                        >
                          <div class="plugin-domain plugin-flat-tool">
                            <div class="plugin-domain-row">
                              <span class="plugin-domain-label">{row().choice.label}</span>
                              {toggle(row().choice)}
                            </div>
                            <p class="plugin-details-description">{row().tools[0]?.description}</p>
                            <PluginInputSchema name={row().choice.label} input={row().tools[0]?.input} />
                          </div>
                        </Show>
                      )
                    }}
                  </Key>
                </SettingsList>
              </Show>
            </section>
          )
        }}
      </Key>
    </div>
  )
}

function PluginInputSchema(props: { name: string; input?: Record<string, unknown> }) {
  const language = useLanguage()
  return (
    <Show when={props.input}>
      <Collapsible variant="ghost">
        <Collapsible.Trigger aria-label={language.t("settings.plugins.inputFor", { name: props.name })}>
          <Collapsible.Arrow />
          {language.t("settings.plugins.input")}
        </Collapsible.Trigger>
        <Collapsible.Content>
          <pre class="plugin-operation-input">{JSON.stringify(props.input, null, 2)}</pre>
        </Collapsible.Content>
      </Collapsible>
    </Show>
  )
}
