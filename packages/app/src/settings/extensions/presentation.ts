import { getAppComposition, type AppInventoryPresentation } from "@/composition"
import { ordered } from "./skill-availability"

export type InventoryGroup<T> = {
  group?: { id: string; title: string; description?: string }
  rows: T[]
}

export type PresentedInventoryRow<T> = T & { documentationUrl?: string }

/** Apply presentation only: retain identity, runtime state, options, and unknown entries. */
export function presentInventory<T extends { id?: string; name?: string; description?: string }>(
  rows: readonly T[],
  presentation?: AppInventoryPresentation,
): PresentedInventoryRow<T>[] {
  const entries = presentation?.entries
  const visible = rows.filter((row) => row.id === undefined || !presentation?.hiddenIDs?.includes(row.id))
  if (!entries?.length) return visible
  const configured = new Map(entries.map((entry, index) => [entry.id, { entry, index }]))
  return visible
    .toSorted(
      (a, b) =>
        (configured.get(a.id ?? "")?.index ?? entries.length) - (configured.get(b.id ?? "")?.index ?? entries.length),
    )
    .map((row) => {
      const value = configured.get(row.id ?? "")?.entry
      if (!value) return row
      return {
        ...row,
        ...(value.name === undefined ? {} : { name: value.name }),
        ...(value.description === undefined ? {} : { description: value.description }),
        ...(value.documentationUrl === undefined ? {} : { documentationUrl: value.documentationUrl }),
      }
    })
}

export function skillInventoryRows<T extends { id: string; name: string; description?: string }>(rows: readonly T[]) {
  return presentInventory(ordered(rows), getAppComposition().skillPresentation)
}

export function groupInventory<T extends { id?: string }>(
  rows: readonly T[],
  presentation?: AppInventoryPresentation,
): InventoryGroup<T>[] {
  if (!presentation?.groups?.length) return [{ rows: [...rows] }]

  const groups = new Map<string, (typeof presentation.groups)[number]>()
  for (const group of presentation.groups) {
    if (!groups.has(group.id)) groups.set(group.id, group)
  }
  const entries = new Map(presentation.entries?.map((entry) => [entry.id, entry]) ?? [])
  const order = presentation.entries?.flatMap((entry) => {
    if (!entry.group || !groups.has(entry.group)) return []
    return entry.group
  })
  const groupOrder = [...new Set(order)]
  const grouped = new Map(groupOrder.map((id) => [id, [] as T[]]))
  const trailing: T[] = []

  for (const row of rows) {
    const id = entries.get(row.id ?? "")?.group
    const section = id ? grouped.get(id) : undefined
    if (section) section.push(row)
    else trailing.push(row)
  }

  const result: InventoryGroup<T>[] = groupOrder.flatMap((id) => {
    const section = grouped.get(id)!
    if (!section.length) return []
    return [{ group: groups.get(id)!, rows: section }]
  })
  if (trailing.length || !result.length) result.push({ rows: trailing })
  return result
}

export function skillInventoryGroups<T extends { id: string }>(rows: readonly T[]) {
  return groupInventory(rows, getAppComposition().skillPresentation)
}

export function pluginInventoryGroups<T extends { id?: string }>(rows: readonly T[]) {
  return groupInventory(rows, getAppComposition().pluginPresentation)
}

export function mcpInventoryGroups<T extends { id?: string }>(rows: readonly T[]) {
  return groupInventory(rows, getAppComposition().mcpPresentation)
}
