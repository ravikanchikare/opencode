import { getAppComposition } from "@/composition"
import { usePlatform } from "@/runtime/platform/platform"
import type { SessionModel } from "../model"
import type { createSessionBrowser } from "./model"

export function createSessionLinkOpener(session: SessionModel, browser: ReturnType<typeof createSessionBrowser>) {
  const platform = usePlatform()
  const origins = embeddedOrigins(getAppComposition().links?.embeddedOrigins ?? [])

  return (url: string) => {
    if (platform.platform !== "desktop") return false
    return openSessionLink({
      url,
      origins,
      available: !!session.identity.sessionID() && browser.available(),
      suspended: browser.suspended(),
      open: () => browser.request({ type: "tabs.open", url, focus: true }),
      fallback: () => platform.openLink(url, { source: "content" }),
    })
  }
}

export function embeddedOrigins(values: readonly string[]) {
  return new Set(
    values.flatMap((value) => {
      if (!URL.canParse(value)) return []
      const url = new URL(value)
      if (url.protocol !== "http:" && url.protocol !== "https:") return []
      return [url.origin]
    }),
  )
}

export function openEmbeddedLink(input: {
  url: string
  origins: ReadonlySet<string>
  available: boolean
  suspended: boolean
  open: () => Promise<void>
  fallback: () => void
}) {
  if (!input.available || input.suspended || !URL.canParse(input.url)) return false
  const url = new URL(input.url)
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !input.origins.has(url.origin)) return false
  void input.open().catch(input.fallback)
  return true
}

export function openSessionLink(input: Parameters<typeof openEmbeddedLink>[0]) {
  if (openEmbeddedLink(input)) return true
  input.fallback()
  return true
}
