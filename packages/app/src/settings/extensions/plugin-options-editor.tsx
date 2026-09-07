import { For, Show, createMemo, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { Key } from "@solid-primitives/keyed"
import { Button } from "@opencode-ai/ui/button"
import { Switch } from "@opencode-ai/ui/switch"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { Icon } from "@opencode-ai/ui/icon"
import { TextInput } from "@opencode-ai/ui/text-input"
import type { PluginInfo } from "@opencode-ai/client"
import { useServerSDK } from "@/runtime/server/client"
import { useLanguage } from "@/runtime/i18n/language"
import { pluginDisplayName } from "@/providers/catalog/plugin"
import { showToast } from "@/shell/notifications/toast"
import { SettingsList } from "@/settings/list"
import { canReset, editorValues, isSelectionActive, optionLabel, scopeOf } from "./plugin-options"
import { filterPluginChoices } from "./plugin-catalog"
import "./extensions.css"

export const PluginOptionsEditor: Component<{
  plugin: PluginInfo
  directory: string | undefined
  onBack?: () => void
  onChanged?: () => unknown | Promise<unknown>
}> = (props) => {
  const serverSDK = useServerSDK()
  const language = useLanguage()
  const [store, setStore] = createStore({ pending: "", query: "", expanded: {} as Record<string, boolean> })
  const scope = () => scopeOf(props.directory)
  const pluginId = () => String(props.plugin.id ?? "")
  const location = () => (props.directory ? { directory: props.directory } : undefined)
  const source = () => {
    const value = props.plugin.source
    if (value.type === "local") return value.path
    if (value.type === "package") return value.target
    return language.t(`settings.plugins.source.${value.type}`)
  }

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
      // Lock controls until the authoritative inventory is refreshed, not just saved.
      await props.onChanged?.()
    } catch (error) {
      showToast({
        variant: "error",
        title: language.t("settings.plugins.saveFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setStore("pending", "")
      // Disabling a pending control can blur it. Preserve keyboard position,
      // but never steal focus if the user moved elsewhere during the request.
      if (focus instanceof HTMLElement && focus.isConnected && document.activeElement === document.body) focus.focus()
    }
  }

  return (
    <div class="plugin-options">
      <Show when={props.onBack}>
        <Button size="small" variant="ghost" class="plugin-details-back" onClick={() => props.onBack?.()}>
          <Icon name="arrow-left" size="small" />
          {language.t("settings.plugins.back")}
        </Button>
      </Show>
      <header class="plugin-details-heading">
        <div class="plugin-details-identity">
          <h2 class="settings-tab-title">{pluginDisplayName(props.plugin)}</h2>
          <span class="plugin-details-status" data-failed={props.plugin.state.status === "failed"}>
            {language.t(`settings.plugins.${props.plugin.state.status}`)}
          </span>
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
      <Show
        when={props.plugin.options?.descriptors.length}
        fallback={<p class="plugin-details-description">{language.t("settings.plugins.noOptions")}</p>}
      >
        <TextInput
          type="search"
          appearance="base"
          value={store.query}
          onInput={(event) => setStore("query", event.currentTarget.value)}
          placeholder={language.t("settings.plugins.search")}
          aria-label={language.t("settings.plugins.search")}
        />
      </Show>
      <Key each={props.plugin.options?.descriptors ?? []} by="key">
        {(descriptor) => {
          const selected = createMemo(
            () => new Set(editorValues(props.plugin, descriptor().key, descriptor().default ?? [])),
          )
          const rows = createMemo(() => filterPluginChoices(descriptor().choices, store.query))
          const applied = () => isSelectionActive(props.plugin, descriptor().key)
          return (
            <section
              class="plugin-options-field"
              aria-label={optionLabel(pluginId(), descriptor().key, descriptor().label)}
            >
              <div class="plugin-details-toolbar">
                <h3 class="settings-section-title">{optionLabel(pluginId(), descriptor().key, descriptor().label)}</h3>
                <span class="plugin-details-description">
                  {language.t("settings.plugins.selected", {
                    selected: descriptor().choices.filter((choice) => selected().has(choice.value)).length,
                    total: descriptor().choices.length,
                  })}
                </span>
              </div>
              <div class="plugin-details-toolbar">
                <div class="plugin-details-actions">
                  <Button
                    size="small"
                    variant="ghost"
                    disabled={!!store.pending || !pluginId()}
                    onClick={() =>
                      void save(
                        descriptor().key,
                        descriptor().choices.map((choice) => choice.value),
                      )
                    }
                  >
                    {language.t("settings.plugins.selectAll")}
                  </Button>
                  <Button
                    size="small"
                    variant="ghost"
                    disabled={!!store.pending || !pluginId()}
                    onClick={() => void save(descriptor().key, [])}
                  >
                    {language.t("settings.plugins.clearAll")}
                  </Button>
                </div>
                <Show when={canReset(props.plugin.options?.inherited ?? true, scope())}>
                  <Button
                    size="small"
                    variant="ghost"
                    disabled={!!store.pending || !pluginId()}
                    onClick={() => void save(descriptor().key, undefined)}
                  >
                    {language.t("settings.plugins.reset")}
                  </Button>
                </Show>
              </div>
              <div role="status" aria-live="polite" class="plugin-details-description">
                <Show
                  when={store.pending === descriptor().key}
                  fallback={<Show when={!applied()}>{language.t("settings.plugins.notActive")}</Show>}
                >
                  {language.t("settings.plugins.applying")}
                </Show>
              </div>
              <Show
                when={rows().length}
                fallback={<p class="plugin-details-description">{language.t("settings.plugins.empty")}</p>}
              >
                <SettingsList>
                  <Key each={rows()} by={(row) => row.choice.value}>
                    {(row) => {
                      const key = () => `${descriptor().key}:${row().choice.value}`
                      return (
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
                                <span class="plugin-details-description">
                                  {language.plural("settings.plugins.operations", row().choice.tools!.length)}
                                </span>
                              </Collapsible.Trigger>
                            </Show>
                            <Switch
                              checked={selected().has(row().choice.value)}
                              hideLabel
                              disabled={!!store.pending || !pluginId()}
                              onChange={(checked) => {
                                const next = new Set(selected())
                                if (checked) next.add(row().choice.value)
                                else next.delete(row().choice.value)
                                void save(descriptor().key, [...next])
                              }}
                            >
                              {row().choice.label}
                            </Switch>
                          </div>
                          <Show when={row().choice.description}>
                            <p class="plugin-details-description">{row().choice.description}</p>
                          </Show>
                          <Collapsible.Content>
                            <div class="plugin-domain-tools">
                              <Key each={row().tools} by="name">
                                {(tool) => (
                                  <div class="plugin-operation">
                                    <code>{tool().name}</code>
                                    <p class="plugin-details-description">{tool().description}</p>
                                    <Show when={tool().input}>
                                      <Collapsible variant="ghost">
                                        <Collapsible.Trigger
                                          aria-label={language.t("settings.plugins.inputFor", { name: tool().name })}
                                        >
                                          <Collapsible.Arrow />
                                          {language.t("settings.plugins.input")}
                                        </Collapsible.Trigger>
                                        <Collapsible.Content>
                                          <pre class="plugin-operation-input">
                                            {JSON.stringify(tool().input, null, 2)}
                                          </pre>
                                        </Collapsible.Content>
                                      </Collapsible>
                                    </Show>
                                  </div>
                                )}
                              </Key>
                            </div>
                          </Collapsible.Content>
                        </Collapsible>
                      )
                    }}
                  </Key>
                </SettingsList>
              </Show>
              <Show when={descriptor().description}>
                <p class="plugin-details-description">{descriptor().description}</p>
              </Show>
            </section>
          )
        }}
      </Key>
      <Show when={props.plugin.options}>
        <p class="plugin-details-description">
          {language.t(
            scope() === "default"
              ? "settings.plugins.default"
              : props.plugin.options?.inherited
                ? "settings.plugins.inherited"
                : "settings.plugins.override",
          )}
        </p>
      </Show>
      <Show
        when={props.plugin.options?.descriptors.some((descriptor) =>
          descriptor.choices.some((choice) => choice.tools?.length),
        )}
      >
        <p class="plugin-details-description">{language.t("settings.plugins.catalog")}</p>
      </Show>
      <Collapsible variant="ghost" class="plugin-details-metadata">
        <Collapsible.Trigger>
          <Collapsible.Arrow />
          {language.t("settings.plugins.details")}
        </Collapsible.Trigger>
        <Collapsible.Content>
          <dl>
            <Show when={pluginId()}>
              <dt>{language.t("settings.plugins.id")}</dt>
              <dd>
                <code>{pluginId()}</code>
              </dd>
            </Show>
            <dt>{language.t("settings.plugins.source")}</dt>
            <dd>{source()}</dd>
            <Show when={props.plugin.source.type === "package" && props.plugin.source.version}>
              {(version) => (
                <>
                  <dt>{language.t("settings.plugins.version")}</dt>
                  <dd>{version()}</dd>
                </>
              )}
            </Show>
            <Show when={Object.values(props.plugin.features).some(Boolean)}>
              <dt>{language.t("settings.plugins.capabilities")}</dt>
              <dd class="plugin-details-actions">
                <For each={(["server", "tui", "rpc"] as const).filter((key) => props.plugin.features[key])}>
                  {(key) => <span>{language.t(`settings.plugins.capability.${key}`)}</span>}
                </For>
              </dd>
            </Show>
          </dl>
          <p class="plugin-details-description">{language.t("settings.plugins.activation")}</p>
        </Collapsible.Content>
      </Collapsible>
    </div>
  )
}
