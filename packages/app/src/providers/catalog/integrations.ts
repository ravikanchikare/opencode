import { useServerSDK } from "@/runtime/server/client"
import { useData } from "@/runtime/server/current"
import { createEffect, type Accessor } from "solid-js"

export function useIntegrations(directory: Accessor<string | undefined>) {
  const serverSDK = useServerSDK()
  const data = useData()
  const location = () => {
    const value = directory()
    return value ? { directory: value } : undefined
  }

  createEffect(() => {
    if (serverSDK.connection.status() !== "connected") return
    const ref = location()
    void (async () => {
      if (!ref) await data.location.syncInfo()
      await data.location.integration.sync(ref ?? data.location.default())
    })().catch(() => undefined)
  })

  return {
    ready: () => data.location.integration.list(location()) !== undefined,
    list: () => data.location.integration.list(location()) ?? [],
  }
}
