const DEFAULT_PRODUCT_NAME = "OpenCode"

export const PRODUCT_NAME = import.meta.env.VITE_OPENCODE_DESKTOP_NAME?.trim() || DEFAULT_PRODUCT_NAME

export const DEEP_LINK_SCHEME = import.meta.env.VITE_OPENCODE_DESKTOP_DEEP_LINK_SCHEME?.trim() || "opencode"

const DEFAULT_SUPPORT_URL = "https://opencode.ai/desktop-feedback"

export interface SupportLink {
  readonly url: string
  readonly labelKey: "error.page.report.discord" | "error.page.report.support"
  readonly icon: "discord" | "help"
}

const STOCK_SUPPORT_LINK: SupportLink = {
  url: DEFAULT_SUPPORT_URL,
  labelKey: "error.page.report.discord",
  icon: "discord",
}

export function resolveSupportLink(configured?: string): SupportLink {
  const url = configured?.trim()
  if (!url || url === DEFAULT_SUPPORT_URL) return STOCK_SUPPORT_LINK
  if (!/^https?:\/\//i.test(url)) return STOCK_SUPPORT_LINK
  return { url, labelKey: "error.page.report.support", icon: "help" }
}

export const SUPPORT_LINK = resolveSupportLink(import.meta.env.VITE_OPENCODE_DESKTOP_SUPPORT_URL)

const IDENTITY_KEYS: ReadonlySet<string> = new Set([
  "app.name.desktop",
  "desktop.menu.app",
  "desktop.menu.ariaLabel",
  "settings.general.row.language.description",
  "settings.general.row.appearance.description",
  "settings.general.row.colorScheme.description",
  "settings.general.row.theme.description",
  "error.page.report.prefix",
  "desktop.recovery.loadFailed",
  "desktop.recovery.terminated",
  "desktop.recovery.unresponsive",
  "desktop.updater.none.message",
  "desktop.updater.downloaded.prompt",
  "toast.update.description",
  "settings.updates.row.startup.description",
  "settings.updates.toast.latest.description",
])

export function brandText(key: string, value: string, productName = PRODUCT_NAME) {
  if (productName === DEFAULT_PRODUCT_NAME) return value
  if (!IDENTITY_KEYS.has(key)) return value
  return value.replaceAll(DEFAULT_PRODUCT_NAME, productName)
}
