import type { PluginInfo } from "@opencode/client"
import { getAppComposition } from "@/composition"
import { scopeOf, type Scope } from "./skill-availability"

export type { Scope }

export function optionLabel(pluginId: string, key: string, fallback: string) {
  return getAppComposition().pluginOptionLabels?.[pluginId]?.[key] ?? fallback
}

/** An authored override at this scope can be removed, including a server default. */
export function canReset(inherited: boolean, _scope?: Scope) {
  return !inherited
}

export function strings(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) ? value.map(String) : undefined
}

/** Values currently active on the plugin, not merely saved. */
export function selectedValues(plugin: PluginInfo, key: string): readonly string[] | undefined {
  return strings(plugin.options?.effective?.[key])
}

export function requestedValues(plugin: PluginInfo, key: string): readonly string[] | undefined {
  return strings(plugin.options?.requested?.[key])
}

export function isSelectionActive(plugin: PluginInfo, key: string) {
  if (plugin.state.status !== "active") return false
  if (plugin.options?.inherited) return true
  const requested = requestedValues(plugin, key)
  const effective = selectedValues(plugin, key)
  if (requested === undefined) return effective !== undefined
  return JSON.stringify(requested) === JSON.stringify(effective)
}

/** Values shown in the editor: active tools when applied, otherwise the saved request. */
export function editorValues(plugin: PluginInfo, key: string, fallback: readonly string[] = []) {
  if (isSelectionActive(plugin, key)) return selectedValues(plugin, key) ?? fallback
  return requestedValues(plugin, key) ?? selectedValues(plugin, key) ?? fallback
}

export function currentPlugin(plugins: readonly PluginInfo[], id: string | undefined) {
  if (!id) return
  return plugins.find((plugin) => String(plugin.id) === id)
}

export { scopeOf }
