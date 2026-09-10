export const DEFAULT_PRODUCT_NAME = "OpenCode"

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

/**
 * Translation keys whose "OpenCode" names *this application*, and so becomes
 * the distribution's product name in a branded build.
 *
 * Every key in the catalog whose value contains "OpenCode" must appear here or
 * in `LITERAL_KEYS`. `brand.test.ts` enforces that, because the failure mode is
 * silent: an unclassified key keeps saying "OpenCode" in a branded build, and
 * nothing surfaces it except a user noticing two product names in one window.
 */
export const IDENTITY_KEYS: ReadonlySet<string> = new Set([
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
  "toast.update.description",
  "settings.updates.row.startup.description",
  "settings.updates.toast.latest.description",
  "settings.plugins.activation",
  "settings.workspaces.empty.description",
  "project.settings.name.description",
  "project.settings.extensions.empty.mcps.description",
  "project.settings.extensions.empty.plugins.description",
  "project.settings.extensions.empty.skills.description",
  "sidebar.gettingStarted.line1",
  "provider.connect.apiKey.description",
  "provider.connect.oauth.code.visit.suffix",
  "provider.connect.oauth.auto.visit.suffix",
  "desktop.menu.documentation",
  "error.chain.mcpFailed",
])

/**
 * Keys whose "OpenCode" is a literal reference that must survive branding: the
 * `opencode` CLI a user installs, the server software a version check names,
 * the Zen service, and the trademark.
 *
 * Rebranding any of these would produce a false statement — an instruction to
 * install a package that does not exist under that name, or a trademark
 * assigned to the wrong company.
 */
export const LITERAL_KEYS: ReadonlySet<string> = new Set([
  // The upstream project, its licence, and its owner.
  "settings.about.description",
  "settings.about.trademark",
  // OpenCode Zen, a named service.
  "provider.connect.opencodeZen.line1",
  "dialog.model.unpaid.freeModels.title",
  // The server this app connects to, and its wire compatibility.
  "dialog.server.description",
  "server.row.incompatible",
  "session.error.incompatible.description",
  "server.connect.scan.invalid",
  "settings.desktop.wsl.description",
  "ssh.stage.checking",
  "ssh.stage.starting",
  "ssh.error.service",
  // Installing and updating the `opencode` package inside WSL.
  "wsl.onboarding.step.opencode",
  "wsl.onboarding.checkingOpencode",
  "wsl.onboarding.checkingOpencodeIn",
  "wsl.onboarding.updatingOpencode",
  "wsl.onboarding.updatingOpencodeIn",
  "wsl.onboarding.updateOpencode",
  "wsl.onboarding.updateOpencodeIn",
  "wsl.onboarding.opencodeReady",
  "wsl.onboarding.opencodeReadyIn",
  "wsl.onboarding.installOpencode",
  "wsl.onboarding.installOpencodeIn",
  "wsl.onboarding.distroStatus.opencodeMissing",
  "wsl.onboarding.wslNotInstalled.description",
  "wsl.onboarding.wslUnavailable.description",
  "wsl.onboarding.windowsRestartRequired",
  "desktop.wsl.error.installOpencode",
  "desktop.wsl.error.opencodeNotInstalled",
  "desktop.wsl.error.updateVersion",
])

export function brandText(key: string, value: string, productName = PRODUCT_NAME) {
  if (productName === DEFAULT_PRODUCT_NAME) return value
  if (!IDENTITY_KEYS.has(key)) return value
  return value.replaceAll(DEFAULT_PRODUCT_NAME, productName)
}
