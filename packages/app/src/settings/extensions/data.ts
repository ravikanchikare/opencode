/**
 * The data an extension destination reads, at one explicit scope.
 *
 * Everything here takes `directory` as an accessor. `undefined` means server
 * scope; a value means that location. That is the only scope switch, and it is
 * a parameter rather than an ambient lookup, so a panel cannot end up reading a
 * different server than the destination that rendered it.
 *
 * The combined Extensions tab and the project dialog's Extensions page keep
 * their own fetching. They present the same domains in a different shape — pill
 * tabs, and a project/shared split — and unifying all three is a larger change
 * than this one, which is about giving a composition somewhere to point instead
 * of writing a fourth copy.
 */

import { createMemo, createResource, type Accessor } from "solid-js"
import type { PluginInfo } from "@opencode/client"
import { pluginLabels } from "@/providers/catalog/plugin"
import { useServerSDK } from "@/runtime/server/client"

export type ExtensionScope = Accessor<string | undefined>

const locationOf = (directory: string | undefined) => (directory ? { directory } : undefined)

/**
 * Resource key: `false` suspends while disconnected, and the directory
 * (or `"@server"`) makes a scope change refetch rather than serve a stale list.
 */
const scopeKey = (connected: boolean, directory: string | undefined) =>
  connected ? (directory ?? "@server") : false

/** Connected state and toggle target for one MCP server, at one scope. */
export interface McpRow {
  readonly name: string
  readonly enabled: boolean
}

export function useMcpServers(directory: ExtensionScope) {
  const serverSDK = useServerSDK()

  const [servers, { refetch }] = createResource(
    () => scopeKey(serverSDK.connection.status() === "connected", directory()),
    (key: string) =>
      serverSDK.api.mcp
        .list({ location: key === "@server" ? undefined : { directory: key } })
        .then((result) => result.data),
    { initialValue: [] },
  )

  const rows = createMemo<McpRow[]>(() =>
    (servers.latest ?? [])
      .map((server) => ({ name: server.name, enabled: server.status.status === "connected" }))
      .toSorted((a, b) => a.name.localeCompare(b.name)),
  )

  return { rows, refetch }
}

export function usePlugins(directory: ExtensionScope) {
  const serverSDK = useServerSDK()

  const [plugins, { refetch }] = createResource(
    () => scopeKey(serverSDK.connection.status() === "connected", directory()),
    async (key: string) => {
      const location = locationOf(key === "@server" ? undefined : key)
      // A plugin snapshot never blocks on activation, so wait for it explicitly
      // or an early read returns a list that is still filling in.
      await serverSDK.api.plugin.awaitActivation({ location })
      return serverSDK.api.plugin.list({ location }).then((result) => result.data)
    },
    { initialValue: [] as PluginInfo[] },
  )

  const names = createMemo(() => pluginLabels(plugins.latest ?? []))
  const rows = createMemo(() =>
    (plugins.latest ?? []).filter((plugin) => plugin.source.type !== "builtin"),
  )

  /** Failure text by label, so a row can explain why a plugin is not loaded. */
  const failures = createMemo(
    () =>
      new Map(
        (plugins.latest ?? []).flatMap((plugin) =>
          plugin.state.status === "failed" ? [[pluginLabel(plugin), String(plugin.state.error)] as const] : [],
        ),
      ),
  )

  return { names, rows, failures, refetch }
}

/**
 * Mirrors `pluginLabels`'s own rule so a failure lines up with its row. Fields
 * arrive branded, so each is normalized before it becomes a map key.
 */
function pluginLabel(plugin: PluginInfo): string {
  if (plugin.id) return String(plugin.id)
  if (plugin.source.type === "package" && plugin.source.target) return String(plugin.source.target)
  if (plugin.source.type === "local" && plugin.source.path) return String(plugin.source.path)
  return plugin.source.type
}
