import { app } from "electron"

type Channel = "local" | "dev" | "beta" | "prod"
const raw = import.meta.env.OPENCODE_CHANNEL
export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"
export const VERSION = app.isPackaged ? app.getVersion() : (process.env.OPENCODE_VERSION ?? app.getVersion())

export const UPDATER_ENABLED = app.isPackaged && CHANNEL !== "dev"

// Distribution identity, resolved from the electron.vite define block. Stock is
// the zero-config default; a branded build supplies these at build time and
// they must agree with the values electron-builder.config.ts packages with.
export const APP_NAME = import.meta.env.OPENCODE_DESKTOP_NAME?.trim()
export const APP_ID = import.meta.env.OPENCODE_DESKTOP_APP_ID?.trim()
export const DEEP_LINK_SCHEME = import.meta.env.OPENCODE_DESKTOP_DEEP_LINK_SCHEME?.trim() || "opencode"
/** Directory name under the app's resources root holding the window and dock icons. */
export const ICON_DIR = import.meta.env.OPENCODE_DESKTOP_ICON_DIR?.trim() || "icons"
/**
 * Segment every XDG root and the managed service port are scoped by.
 *
 * This is a deliberate isolation lever, not part of branding. Left unset — the
 * default even for a fully branded build — the app shares `~/.config/opencode`,
 * the shared data roots, and the managed service with stock OpenCode, so a user
 * running both sees one set of projects, credentials, and settings. Set it only
 * when a distribution genuinely needs its own state, and expect a user with
 * both installed to configure each separately from then on.
 *
 * The stock default mirrors `Global.DEFAULT_APP_ID`; `packages/desktop` cannot
 * depend on `packages/util`, so it is repeated here rather than shared.
 */
export const APP_IDENTITY = import.meta.env.OPENCODE_APP_ID?.trim() || "opencode"

/**
 * Identifies the background server this build runs, separately from where its
 * configuration lives.
 *
 * Derived from whatever identifies this build as a distribution — its bundle id,
 * or failing that its product name — so any branded build gets its own server
 * without a further knob, including an unpackaged one. It shares stock
 * OpenCode's config directory, credentials, and projects, but the allowlist and
 * seeded plugins it starts its server with apply to itself rather than to
 * whichever app happened to launch a shared server first.
 *
 * A build with no branding at all is stock and keeps stock's service, so a
 * plain `bun run dev` still attaches to the server it always did.
 * `OPENCODE_SERVICE_ID` overrides the derivation — set it to `opencode` to
 * deliberately share stock's server.
 */
export const SERVICE_ID =
  import.meta.env.OPENCODE_SERVICE_ID?.trim() ||
  APP_ID ||
  APP_NAME?.toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") ||
  "opencode"
