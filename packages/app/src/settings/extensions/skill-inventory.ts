import { createResource, createSignal } from "solid-js"
import { ordered, type SkillRow } from "./skill-availability"

type Inventory = { scope: string | false; rows: SkillRow[] }

/** Owns loading and mutations for both Skills views without throwing failed reads into the page. */
export function createSkillInventory(input: {
  scope: () => string | false
  load: (scope: string) => Promise<readonly SkillRow[]>
  save: (scope: string, skill: SkillRow, enabled: boolean | undefined) => Promise<unknown>
  onError: (error: unknown, phase: "load" | "save" | "refresh") => void
}) {
  const [pending, setPending] = createSignal<string>()
  const [inventory, { refetch }] = createResource<Inventory, string, "saved">(
    input.scope,
    (scope, info) =>
      input.load(scope).then(
        (rows) => ({ scope, rows: ordered(rows) }),
        (error) => {
          input.onError(error, info.refetching === "saved" ? "refresh" : "load")
          return { scope, rows: info.value?.scope === scope ? info.value.rows : [] }
        },
      ),
    { initialValue: { scope: false, rows: [] } },
  )

  return {
    rows: () => (inventory.latest.scope === input.scope() ? inventory.latest.rows : []),
    loading: () => inventory.loading,
    pending,
    refetch: () => refetch(),
    async set(skill: SkillRow, enabled: boolean | undefined) {
      const scope = input.scope()
      if (!scope || pending()) return
      setPending(skill.id)
      await input
        .save(scope, skill, enabled)
        .then(
          () => {
            if (input.scope() === scope) return refetch("saved")
          },
          (error) => input.onError(error, "save"),
        )
        .finally(() => setPending())
    },
  }
}
