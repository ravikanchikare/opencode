import { getAppComposition, type AppInventoryPresentation } from "@/composition"
import { ordered } from "./skill-availability"

/** Apply presentation only: retain identity, runtime state, options, and unknown entries. */
export function presentInventory<T extends { id?: string; name?: string; description?: string }>(
  rows: readonly T[],
  presentation?: AppInventoryPresentation,
): T[] {
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
      }
    })
}

export function skillInventoryRows<T extends { id: string; name: string; description?: string }>(rows: readonly T[]) {
  return presentInventory(ordered(rows), getAppComposition().skillPresentation)
}
