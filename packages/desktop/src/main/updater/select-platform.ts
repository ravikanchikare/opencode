export type UpdaterPlatformKind = "external" | "stock" | "none"

/**
 * Workbench darwin loads a starter-shipped native apply engine when one is
 * present. Unbranded OpenCode keeps electron-updater. A branded Darwin build
 * never falls through to Squirrel: a missing engine means disabled.
 */
export function updaterPlatformKind(input: {
  platform: string
  appId: string | undefined
  updaterEnabled: boolean
}): UpdaterPlatformKind {
  if (input.platform === "darwin" && input.appId) return "external"
  if (input.updaterEnabled) return "stock"
  return "none"
}
