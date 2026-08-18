const DEFAULT_PRODUCT_NAME = "OpenCode"

export const PRODUCT_NAME = import.meta.env.VITE_OPENCODE_DESKTOP_NAME?.trim() || DEFAULT_PRODUCT_NAME

/**
 * URL scheme this build is registered for. The Electron main process registers
 * it with the OS and filters incoming argv by it, so the renderer has to accept
 * the same one or every deep link a branded build receives is dropped here.
 */
export const DEEP_LINK_SCHEME = import.meta.env.VITE_OPENCODE_DESKTOP_DEEP_LINK_SCHEME?.trim() || "opencode"

/**
 * Translation keys that name the *running application*.
 *
 * A distribution renames itself so a user can tell it apart from stock
 * OpenCode when both are installed — not to hide OpenCode. Every other
 * "OpenCode" in the dictionaries refers to the upstream product or its
 * ecosystem: OpenCode Zen, the `opencode` CLI installed into WSL, the OpenCode
 * server, the docs, the models OpenCode provides. Those stay as written, so the
 * keys that get rewritten are enumerated here rather than found by scanning
 * translated output — a scan would advertise products the distribution does not
 * own and would silently rebrand every new upstream string.
 *
 * Keys come from the app, desktop-native, and desktop-renderer dictionaries.
 * They share one namespace and do not collide.
 */
const IDENTITY_KEYS: ReadonlySet<string> = new Set([
  // The application's own name, in menus, titles, and Settings copy.
  "app.name.desktop",
  "desktop.menu.app",
  "desktop.menu.ariaLabel",
  "settings.general.row.language.description",
  "settings.general.row.appearance.description",
  "settings.general.row.colorScheme.description",
  "settings.general.row.theme.description",
  // This application failing, and this application updating itself.
  "desktop.recovery.loadFailed",
  "desktop.recovery.terminated",
  "desktop.recovery.unresponsive",
  "desktop.updater.none.message",
  "desktop.updater.downloaded.prompt",
  "toast.update.description",
  "settings.updates.row.startup.description",
  "settings.updates.toast.latest.description",
])

/** Applies the distribution's product name to the strings that name the app itself. */
export function brandText(key: string, value: string, productName = PRODUCT_NAME) {
  if (productName === DEFAULT_PRODUCT_NAME) return value
  if (!IDENTITY_KEYS.has(key)) return value
  return value.replaceAll(DEFAULT_PRODUCT_NAME, productName)
}
