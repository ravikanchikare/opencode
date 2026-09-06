import type { PluginInfo } from "@opencode-ai/client"
import { getAppComposition } from "@/composition"
import { scopeOf, type Scope } from "./skill-availability"

export type { Scope }

export function optionLabel(pluginId: string, key: string, fallback: string) {
  return getAppComposition().pluginOptionLabels?.[pluginId]?.[key] ?? fallback
}

export function canReset(inherited: boolean, scope: Scope) {
  return scope === "location" && !inherited
}

export function selectedValues(plugin: PluginInfo, key: string): readonly string[] | undefined {
  const requested = plugin.options?.requested?.[key]
  const effective = plugin.options?.effective?.[key]
  const value = plugin.options?.inherited ? effective : (requested ?? effective)
  return Array.isArray(value) ? value.map(String) : undefined
}

export { scopeOf }
