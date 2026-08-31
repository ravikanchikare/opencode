import { createSignal } from "solid-js"

export function createExtensionToggle(input: {
  readonly mutate: (id: string, enabled: boolean | undefined) => Promise<unknown>
  readonly refresh: () => unknown
  readonly onError: (error: unknown) => void
}) {
  const [pending, setPending] = createSignal<ReadonlySet<string>>(new Set())

  const run = async (id: string, enabled: boolean | undefined) => {
    if (pending().has(id)) return
    setPending((current) => new Set(current).add(id))
    try {
      await input.mutate(id, enabled)
      await input.refresh()
    } catch (error) {
      input.onError(error)
    } finally {
      setPending((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }

  return {
    pending: (id: string) => pending().has(id),
    run,
  }
}
