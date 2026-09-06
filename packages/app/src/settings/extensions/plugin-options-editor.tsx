import { For, Show, createSignal, type Component } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Checkbox } from "@opencode-ai/ui/checkbox"
import type { PluginInfo } from "@opencode-ai/client"
import { useServerSDK } from "@/runtime/server/client"
import { showToast } from "@/shell/notifications/toast"
import { canReset, optionLabel, scopeOf, selectedValues } from "./plugin-options"

export const PluginOptionsEditor: Component<{
  plugin: PluginInfo
  directory: string | undefined
  onBack?: () => void
  onChanged?: () => void
}> = (props) => {
  const serverSDK = useServerSDK()
  const [pending, setPending] = createSignal<string>()
  const scope = () => scopeOf(props.directory)
  const pluginId = () => String(props.plugin.id ?? "")
  const location = () => (props.directory ? { directory: props.directory } : undefined)

  const save = async (key: string, value: readonly string[] | undefined) => {
    if (!pluginId() || pending()) return
    setPending(key)
    try {
      await serverSDK.api.plugin.setOptions({
        plugin: pluginId(),
        location: location(),
        payload: value === undefined ? { key, inherit: true as const } : { key, value: [...value] },
      })
      props.onChanged?.()
    } catch (error) {
      showToast({
        variant: "error",
        title: "Plugin options could not be applied",
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setPending()
    }
  }

  return (
    <div class="plugin-options">
      <Show when={props.onBack}>
        <button type="button" class="extension-destination-reset" onClick={() => props.onBack?.()}>
          Back
        </button>
      </Show>
      <Show when={props.plugin.state.status === "failed" ? props.plugin.state.error : undefined}>
        {(error) => <p class="extension-destination-description">{String(error())}</p>}
      </Show>
      <For each={props.plugin.options?.descriptors ?? []}>
        {(descriptor) => {
          const selected = () => new Set(selectedValues(props.plugin, descriptor.key) ?? descriptor.default ?? [])
          const applying = () => pending() === descriptor.key
          return (
            <div class="plugin-options-field">
              <div class="plugin-options-field-header">
                <span class="extension-destination-name">
                  {optionLabel(pluginId(), descriptor.key, descriptor.label)}
                </span>
                <Show when={descriptor.description}>
                  <span class="extension-destination-description">{descriptor.description}</span>
                </Show>
              </div>
              <div class="extension-destination-controls">
                <Show when={canReset(props.plugin.options?.inherited ?? true, scope())}>
                  <button
                    type="button"
                    class="extension-destination-reset"
                    disabled={applying()}
                    onClick={() => void save(descriptor.key, undefined)}
                  >
                    Use default selection
                  </button>
                </Show>
                <Button
                  size="small"
                  variant="ghost"
                  disabled={applying()}
                  onClick={() => void save(descriptor.key, descriptor.choices.map((choice) => choice.value))}
                >
                  Select all
                </Button>
                <Button size="small" variant="ghost" disabled={applying()} onClick={() => void save(descriptor.key, [])}>
                  Clear all
                </Button>
              </div>
              <Show when={applying()}>
                <span class="extension-destination-description">Applying…</span>
              </Show>
              <For each={descriptor.choices}>
                {(choice) => (
                  <Checkbox
                    checked={selected().has(choice.value)}
                    disabled={applying()}
                    onChange={(checked) => {
                      const next = new Set(selected())
                      if (checked) next.add(choice.value)
                      else next.delete(choice.value)
                      void save(descriptor.key, [...next])
                    }}
                  >
                    {choice.label}
                  </Checkbox>
                )}
              </For>
            </div>
          )
        }}
      </For>
    </div>
  )
}
