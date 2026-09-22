import type { SettingsTabEntry } from "@/composition"
import type { SettingsNavGroup, SettingsNavItem } from "./navigation"

export type SettingsTabComposition = {
  hide?: readonly string[]
  add?: readonly SettingsTabEntry[]
  groups?: readonly (readonly string[])[]
  showConfigPath?: boolean
}

const projectExtensionPanels = ["skills", "mcp", "plugins"] as const

/** A mutable group under construction; `SettingsNavGroup.items` is readonly. */
type DraftGroup = { label?: string; action?: SettingsNavGroup["action"]; items: SettingsNavItem[] }

const navItem = (entry: SettingsTabEntry): SettingsNavItem => ({
  value: entry.value,
  icon: entry.icon,
  label: entry.label,
})

/**
 * A composed `add` entry is a real root destination — same Kobalte Tabs list
 * as Preferences and Models. The Settings view used to whitelist only stock
 * values, so these triggers took focus, never became `value`, and each click
 * or arrow key still replaced the route.
 */
export function isComposedSettingsTab(value: string, composition?: SettingsTabComposition): boolean {
  return composition?.add?.some((entry) => entry.value === value) ?? false
}

export function composedProjectExtensionTabs(composition?: SettingsTabComposition): SettingsNavItem[] | undefined {
  const entries = composition?.add?.filter(
    (entry) =>
      entry.panel !== undefined &&
      projectExtensionPanels.some((panel) => panel === entry.panel) &&
      entry.value === entry.panel,
  )
  if (!entries || !projectExtensionPanels.every((panel) => entries.some((entry) => entry.panel === panel))) return
  return entries.map(navItem)
}

export function projectExtensionDestination(
  subtab: "mcps" | "plugins" | "skills" | "lsps" | undefined,
  composition?: SettingsTabComposition,
): "extensions" | "skills" | "mcp" | "plugins" | "language-servers" {
  const tabs = composedProjectExtensionTabs(composition)
  if (!tabs) return "extensions"
  if (!subtab) {
    const first = tabs[0].value
    if (first === "skills" || first === "mcp" || first === "plugins") return first
    return "extensions"
  }
  if (subtab === "lsps") return "extensions"
  const panel = subtab === "mcps" ? "mcp" : subtab
  return composition?.add?.some((entry) => entry.panel === panel && entry.value === panel) ? panel : "extensions"
}

export function composeProjectSettingsNavItems(
  items: readonly SettingsNavItem[],
  composition?: SettingsTabComposition,
): SettingsNavItem[] {
  const promoted = composedProjectExtensionTabs(composition)
  if (!promoted) return [...items]
  return items.flatMap((item) => (item.value === "extensions" ? promoted : [item]))
}

/**
 * With several servers, server-scoped destinations live under each server, so
 * composed tabs join a server's nested list there: panel tabs replace its
 * Extensions entry as they do for a project, and the rest follow.
 */
export function composeServerSettingsNavItems(
  items: readonly SettingsNavItem[],
  composition?: SettingsTabComposition,
): SettingsNavItem[] {
  const promoted = new Set(composedProjectExtensionTabs(composition)?.map((item) => item.value))
  const rest = (composition?.add ?? []).filter((entry) => !promoted.has(entry.value)).map(navItem)
  return [...composeProjectSettingsNavItems(items, composition), ...rest]
}

/**
 * Applies a composition to the nav groups the host just computed.
 *
 * It post-processes rather than rebuilds because the host's items carry state no
 * value list can hold — `disabled` while no server is reachable, `onPrefetch`
 * for the workspaces query, and the per-connection server group's own header and
 * add-server action. Items are therefore carried through **by reference**:
 * hiding, adding and regrouping change which items appear and in what order, and
 * nothing else about them.
 */
export function composeSettingsNavGroups(
  groups: readonly SettingsNavGroup[],
  composition?: SettingsTabComposition,
): SettingsNavGroup[] {
  if (!composition) return [...groups]

  const hidden = new Set(composition.hide ?? [])
  const visible: DraftGroup[] = []
  for (const group of groups) {
    const items = group.items.filter((item) => !hidden.has(item.value))
    if (items.length > 0) visible.push({ label: group.label, action: group.action, items })
  }

  // A composed tab with a `before` anchor joins that item's group in place;
  // the rest are appended, where a `groups` declaration can still place them.
  const appended: SettingsNavItem[] = []
  for (const entry of composition.add ?? []) {
    const item = navItem(entry)
    const target = entry.before
      ? visible.find((group) => group.items.some((candidate) => candidate.value === entry.before))
      : undefined
    if (!target) {
      appended.push(item)
      continue
    }
    target.items.splice(
      target.items.findIndex((candidate) => candidate.value === entry.before),
      0,
      item,
    )
  }

  if (!composition.groups) return [...visible, ...(appended.length > 0 ? [{ items: appended }] : [])]

  // A declaration owns the order of every value it names. Groups carrying their
  // own label or action are left whole: the host builds those per connection, so
  // their values are runtime keys a declaration cannot name, and flattening them
  // into the fallback would drop the header and the add-server menu with it.
  const anchored = visible.filter((group) => group.label !== undefined || group.action !== undefined)
  const anchoredValues = new Set(anchored.flatMap((group) => group.items.map((item) => item.value)))
  const pool = new Map<string, SettingsNavItem>()
  for (const item of [...visible.flatMap((group) => group.items), ...appended])
    if (!anchoredValues.has(item.value)) pool.set(item.value, item)

  const declared = new Set<string>()
  const configured = composition.groups
    .map((group) => ({
      items: group.flatMap((value) => {
        const item = pool.get(value)
        if (!item || declared.has(value)) return []
        declared.add(value)
        return [item]
      }),
    }))
    .filter((group) => group.items.length > 0)
  const fallback = [...pool.values()].filter((item) => !declared.has(item.value))

  return [...configured, ...anchored, ...(fallback.length > 0 ? [{ items: fallback }] : [])]
}
