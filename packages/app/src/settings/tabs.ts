import type { SettingsTabEntry } from "@/composition"
import type { SettingsNavGroup, SettingsNavItem } from "./navigation"

export type SettingsTabComposition = {
  hide?: readonly string[]
  add?: readonly SettingsTabEntry[]
  groups?: readonly (readonly string[])[]
  showConfigPath?: boolean
}

/** A mutable group under construction; `SettingsNavGroup.items` is readonly. */
type DraftGroup = { label?: string; action?: SettingsNavGroup["action"]; items: SettingsNavItem[] }

const navItem = (entry: SettingsTabEntry): SettingsNavItem => ({
  value: entry.value,
  icon: entry.icon,
  label: entry.label,
})

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
