import { beforeAll, describe, expect, mock, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"

let providerList = () => [] as unknown[]
let providerPending = () => false

const data = {
  location: {
    default: () => ({ directory: "/project" }),
    syncInfo: () => Promise.resolve(),
    provider: {
      list: () => providerList(),
      pending: () => providerPending(),
      sync: () => Promise.resolve(),
    },
    model: {
      list: () => [],
      pending: () => false,
      sync: () => Promise.resolve(),
      default: {
        sync: () => Promise.resolve(),
      },
    },
  },
}

let useProviders: typeof import("./providers").useProviders

beforeAll(async () => {
  mock.module("@/runtime/server/current", () => ({
    useData: () => data,
  }))
  mock.module("@/runtime/server/client", () => ({
    useServerSDK: () => ({ connection: { status: () => "connected" } }),
  }))
  mock.module("./integrations", () => ({
    useIntegrations: () => ({
      ready: () => true,
      list: () => [],
    }),
  }))
  useProviders = (await import("./providers")).useProviders
})

describe("provider catalog readiness", () => {
  test("stays pending when an empty list has an outstanding replacement", () => {
    const [list, setList] = createSignal<unknown[]>([])
    const [pending, setPending] = createSignal(true)
    providerList = list
    providerPending = pending

    createRoot((dispose) => {
      const providers = useProviders(() => "/project")
      expect(providers.ready()).toBe(false)

      setList([{ id: "connected" }])
      setPending(false)
      expect(providers.ready()).toBe(true)
      dispose()
    })
  })

  test("becomes ready when the settled list is empty", () => {
    const [list] = createSignal<unknown[]>([])
    const [pending, setPending] = createSignal(true)
    providerList = list
    providerPending = pending

    createRoot((dispose) => {
      const providers = useProviders(() => "/project")
      expect(providers.ready()).toBe(false)

      setPending(false)
      expect(providers.ready()).toBe(true)
      dispose()
    })
  })
})
