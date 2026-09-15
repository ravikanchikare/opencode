import { app } from "electron"
import { readPackagedProvider } from "./updater/packaged-provider"
import { selectUpdater, stockUpdateFeedConfigured, type UpdaterSelection } from "./updater/selection"

type Channel = "local" | "dev" | "beta" | "prod"
const raw = import.meta.env.OPENCODE_CHANNEL
export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"
export const VERSION = app.isPackaged ? app.getVersion() : (process.env.OPENCODE_VERSION ?? app.getVersion())

export const APP_NAME = import.meta.env.OPENCODE_DESKTOP_NAME?.trim()

/** The product name shown to a user. Stock builds are "OpenCode". */
export const PRODUCT_NAME = APP_NAME || "OpenCode"
export const APP_ID = import.meta.env.OPENCODE_DESKTOP_APP_ID?.trim()
export const DEEP_LINK_SCHEME = import.meta.env.OPENCODE_DESKTOP_DEEP_LINK_SCHEME?.trim() || "opencode"
export const MANUAL_UPDATE_URL = import.meta.env.OPENCODE_DESKTOP_MANUAL_UPDATE_URL?.trim()
export const ICON_DIR = import.meta.env.OPENCODE_DESKTOP_ICON_DIR?.trim() || "icons"
export const APP_IDENTITY = import.meta.env.OPENCODE_APP_ID?.trim() || "opencode"

export const SERVICE_ID =
  import.meta.env.OPENCODE_SERVICE_ID?.trim() ||
  APP_ID ||
  APP_NAME?.toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") ||
  "opencode"

/**
 * Which updater this build runs, resolved once.
 *
 * Read lazily: `process.resourcesPath` is only meaningful in a packaged app,
 * and nothing should pay for a filesystem read at import time.
 */
let selection: UpdaterSelection | undefined
export function updaterSelection(): UpdaterSelection {
  return (selection ??= selectUpdater({
    packaged: app.isPackaged,
    channel: CHANNEL,
    provider: readPackagedProvider({ packaged: app.isPackaged, resourcesPath: process.resourcesPath }),
    stockFeed: stockUpdateFeedConfigured({
      appId: APP_ID,
      updateUrl: import.meta.env.OPENCODE_DESKTOP_UPDATE_URL,
      updateRepo: import.meta.env.OPENCODE_DESKTOP_UPDATE_REPO,
    }),
  }))
}
