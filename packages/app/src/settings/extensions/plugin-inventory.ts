import { createResource } from "solid-js"
import type { PluginInfo } from "@opencode/client"

type Inventory = { scope: string | false; rows: readonly PluginInfo[]; error?: string }

/** Retain same-scope rows on refresh; an initial failure is not an empty inventory. */
export function createPluginInventory(input: {
  scope: () => string | false
  load: (scope: string) => Promise<readonly PluginInfo[]>
}) {
  const [inventory, { refetch }] = createResource<Inventory, string>(
    input.scope,
    (scope, info) =>
      input.load(scope).then(
        (rows) => ({ scope, rows }),
        (error) => ({
          scope,
          rows: info.value?.scope === scope ? info.value.rows : [],
          error: error instanceof Error ? error.message : String(error),
        }),
      ),
    { initialValue: { scope: false, rows: [] } },
  )
  const current = () => (inventory.latest.scope === input.scope() ? inventory.latest : undefined)
  return {
    rows: () => current()?.rows ?? [],
    error: () => current()?.error,
    loading: () => !input.scope() || inventory.loading || !current(),
    refetch,
  }
}
