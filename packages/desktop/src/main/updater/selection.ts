import type { PackagedProviderResult, PackagedUpdaterProvider } from "./packaged-provider"

/**
 * Which updater — if any — this build runs.
 *
 * Four outcomes, deliberately distinguishable:
 *
 * - `disabled`  updates are off by construction (a development run, or a build
 *               with nothing to update from). Nothing is wrong.
 * - `stock`     electron-updater, OpenCode's own behavior.
 * - `provider`  a packaged updater provider the distribution selected.
 * - `unavailable` a provider *is* selected and cannot be used. This is a fault
 *               and reaches the user as an error with a message, never as a
 *               quietly update-less application.
 */
export type UpdaterSelection =
  | { readonly kind: "disabled" }
  | { readonly kind: "stock" }
  | { readonly kind: "provider"; readonly provider: PackagedUpdaterProvider }
  | { readonly kind: "unavailable"; readonly message: string }

/**
 * Can electron-updater find a feed?
 *
 * electron-builder embeds `app-update.yml` only when it wrote a `publish`
 * config: for stock OpenCode that is its own releases, and for any other build
 * it is whatever feed the packager named. A build with neither has no stock
 * updater to run — not because it is branded, but because nothing told
 * electron-updater where to look.
 */
export function stockUpdateFeedConfigured(input: {
  readonly appId: string | undefined
  readonly updateUrl: string | undefined
  readonly updateRepo: string | undefined
}): boolean {
  if (input.updateUrl?.trim() || input.updateRepo?.trim()) return true
  return !input.appId?.trim()
}

export function selectUpdater(input: {
  readonly packaged: boolean
  readonly channel: string
  readonly provider: PackagedProviderResult
  readonly stockFeed: boolean
}): UpdaterSelection {
  // Updates deliberately off: an unpackaged tree replaces itself with a
  // rebuild, and `dev` is not a channel anything publishes to.
  if (!input.packaged || input.channel === "dev") return { kind: "disabled" }
  if (!input.provider.ok) return { kind: "unavailable", message: input.provider.message }
  if (input.provider.provider) return { kind: "provider", provider: input.provider.provider }
  return input.stockFeed ? { kind: "stock" } : { kind: "disabled" }
}
