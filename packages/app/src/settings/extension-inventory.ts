import type { PluginInfo, SkillInventory } from "@opencode-ai/client"
import { pluginLabel } from "@/providers/catalog/plugin"

export type PluginRow = PluginInfo & {
  readonly key: string
  readonly name: string
  readonly enabled: boolean
  readonly inherited: boolean
  readonly defaultEnabled: boolean
}

export function pluginRows(items: readonly PluginInfo[]): PluginRow[] {
  return items
    .filter((item) => item.source.type !== "builtin")
    .map((item) => ({
      ...item,
      key: item.id ?? `${item.source.type}:${pluginLabel(item)}`,
      name: pluginLabel(item),
      enabled: item.state.status === "active",
      inherited: item.state.status === "failed" ? true : (item.inherited ?? true),
      defaultEnabled: item.state.status === "failed" ? true : (item.defaultEnabled ?? true),
    }))
}

export function splitInventory<T>(current: readonly T[], global: readonly T[], key: (item: T) => string) {
  const shared = new Set(global.map(key))
  return {
    added: current.filter((item) => !shared.has(key(item))),
    shared: current.filter((item) => shared.has(key(item))),
  }
}

export const skillKey = (item: SkillInventory) => item.id
