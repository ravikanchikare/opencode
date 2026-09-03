import { app } from "electron"

type Channel = "local" | "dev" | "beta" | "prod"
const raw = import.meta.env.OPENCODE_CHANNEL
export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"
export const VERSION = app.isPackaged ? app.getVersion() : (process.env.OPENCODE_VERSION ?? app.getVersion())

export const APP_NAME = import.meta.env.OPENCODE_DESKTOP_NAME?.trim()
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

export const UPDATER_ENABLED =
  app.isPackaged &&
  CHANNEL !== "dev" &&
  (!APP_ID ||
    Boolean(
      import.meta.env.OPENCODE_DESKTOP_UPDATE_URL?.trim() || import.meta.env.OPENCODE_DESKTOP_UPDATE_REPO?.trim(),
    ))
