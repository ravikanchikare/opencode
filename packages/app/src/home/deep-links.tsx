import { ServerConnection, useServers } from "@/runtime/server/registry"
import { useGlobal } from "@/runtime/server/runtime"
import { useLayout } from "@/shell/state/layout"
import { onCleanup } from "solid-js"
import { addHomeProjects } from "./model"

const deepLinkEvent = "opencode:deep-link"

export function HomeDeepLinks() {
  const global = useGlobal()
  const layout = useLayout()
  const servers = useServers()
  const openProjects = (event: Event) => {
    const urls = deepLinkUrls(event)
    if (!urls) return
    const conn =
      servers.visible.find((item) => ServerConnection.key(item) === layout.home.selection().server) ?? servers.visible[0]
    if (!conn) return
    urls.flatMap(projectPath).forEach((path) => addHomeProjects(global, layout.home.setSelection, conn, [path]))
  }
  window.addEventListener(deepLinkEvent, openProjects)
  onCleanup(() => window.removeEventListener(deepLinkEvent, openProjects))
  return null
}

function deepLinkUrls(event: Event) {
  if (!(event instanceof CustomEvent)) return
  const detail: unknown = event.detail
  if (typeof detail !== "object" || detail === null || !("urls" in detail) || !Array.isArray(detail.urls)) return
  return detail.urls.filter((url): url is string => typeof url === "string")
}

export function projectPath(url: string) {
  try {
    const link = new URL(url)
    if (link.protocol !== "opencode:" || link.hostname !== "open-project") return []
    const path = link.searchParams.get("path")
    return path ? [path] : []
  } catch {
    console.warn("[home-deep-link] ignored malformed deep link", { url })
    return []
  }
}
