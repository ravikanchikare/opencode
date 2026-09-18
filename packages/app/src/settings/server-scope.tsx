import { type ParentProps, Show, createMemo } from "solid-js"
import { useGlobal } from "@/runtime/server/runtime"
import { ModelsProvider } from "@/providers/models/models"
import { ServerProvider } from "@/runtime/server/current"
import { ServerConnection } from "@/runtime/server/registry"

/**
 * Scopes a composed surface to a server it did not choose.
 *
 * Composed Settings destinations already render inside `SettingsServerDataScope`,
 * so for them this is a no-op wrapper. It exists for registrations that render
 * *outside* Settings — a provider-connection banner in the shell, say — which
 * still need a server and a models scope but have no route to derive one from.
 *
 * The host used to track a selected Settings server (`global.settings.server`)
 * and this read it. That selection is gone: Settings now routes to a server
 * explicitly and passes the connection down. Only the old selector's fallback
 * remains reachable, so that is what this keeps — the first server in the list.
 */
export function SettingsServerScope(props: ParentProps<{ directory?: string }>) {
  const global = useGlobal()
  const server = createMemo(() => global.servers.list()[0])
  return (
    <Show when={server()} keyed fallback={props.children}>
      {(connection) => (
        <SettingsServerDataScope server={connection} directory={props.directory}>
          {props.children}
        </SettingsServerDataScope>
      )}
    </Show>
  )
}

export function SettingsServerDataScope(props: ParentProps<{ server: ServerConnection.Any; directory?: string }>) {
  return (
    <ServerProvider conn={props.server}>
      <ModelsProvider directory={props.directory}>{props.children}</ModelsProvider>
    </ServerProvider>
  )
}
