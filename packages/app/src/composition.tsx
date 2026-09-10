import type { Component } from "solid-js"
import type { IconProps } from "@opencode/ui/icon"
import type { useLanguage } from "@/runtime/i18n/language"
import type { Settings } from "@/settings/model"

export type SettingsPanelProps = {
  directory: string | undefined
  onBack?: () => void
}

export type HomeUtilityNavSurfaceProps = {
  class?: string
  onOpenSettings: () => void
  onOpenHelp: () => void
  language: ReturnType<typeof useLanguage>
}

export type OnboardingSurfaceProps = {
  complete: (options?: { openProject?: boolean }) => Promise<void>
}

export type ProviderConnectionBannerSurfaceProps = {}

export type SettingsProvidersSurfaceProps = SettingsPanelProps
export type SettingsTabContentProps = SettingsPanelProps

/**
 * A destination the host already implements. Naming one is how a composition
 * says "present MCP as its own tab" without restating what an MCP tab does —
 * see `settings/extensions/panels.tsx`.
 */
export type SettingsExtensionPanel = "mcp" | "plugins" | "skills" | "integrations"

type SettingsTabNavigation = {
  value: string
  icon: IconProps["name"]
  label: string
  before?: string
}

/**
 * Either the composition supplies the body, or it names a native panel and
 * supplies navigation metadata only. The union is exclusive so a registration
 * cannot quietly carry both and leave which one wins to reading order.
 */
export type SettingsTabEntry = SettingsTabNavigation &
  ({ content: Component<SettingsTabContentProps>; panel?: never } | { panel: SettingsExtensionPanel; content?: never })

export type AppSettingsDefaults = {
  general?: Partial<Settings["general"]>
  appearance?: Partial<Settings["appearance"]>
  keybinds?: Settings["keybinds"]
  permissions?: Partial<Settings["permissions"]>
  workspaces?: Partial<Settings["workspaces"]>
  notifications?: Partial<Settings["notifications"]>
  sounds?: Partial<Settings["sounds"]>
}

export type AppNewSessionComposition = {
  showProviderTip?: boolean
}

/** Entries are displayed in configured order; unconfigured inventory rows follow. */
export type AppInventoryPresentation = {
  entries?: readonly { id: string; name?: string; description?: string }[]
  /** Hide rows in Settings only; runtime inventories and commands remain unchanged. */
  hiddenIDs?: readonly string[]
}

/** Settings-only policy for plugin inventory rows and technical metadata. */
export type AppPluginPresentation = AppInventoryPresentation & {
  hiddenPluginIDs?: readonly string[]
  /** Hide the technical metadata accordion, not the plugin's configuration controls. */
  hiddenMetadataPluginIDs?: readonly string[]
}

export type AppComposition = {
  pluginOptionLabels?: Readonly<Record<string, Readonly<Record<string, string>>>>
  pluginPresentation?: AppPluginPresentation
  skillPresentation?: AppInventoryPresentation
  mcpPresentation?: AppInventoryPresentation
  settingsDefaults?: AppSettingsDefaults
  onboarding?: Component<OnboardingSurfaceProps>
  providerConnectionBanner?: Component<ProviderConnectionBannerSurfaceProps>
  settingsProviders?: Component<SettingsProvidersSurfaceProps>
  homeUtilityNav?: Component<HomeUtilityNavSurfaceProps>
  modelSelector?: { showProviderPromotions?: boolean }
  newSession?: AppNewSessionComposition
  settingsTabs?: {
    hide?: readonly string[]
    add?: readonly SettingsTabEntry[]
    groups?: readonly (readonly string[])[]
    showConfigPath?: boolean
  }
}

let composition: AppComposition = {}

export function configureAppComposition(value: AppComposition) {
  composition = { ...value }
}

export function getAppComposition() {
  return composition
}

/**
 * Settings inventories can omit identified plugins without changing the host's
 * plugin lifecycle, provenance, or API responses. Unidentified entries remain
 * visible so failed plugin rows retain their diagnostic value.
 */
export function isPluginVisible(pluginID: string | undefined, value: AppComposition = composition) {
  return (
    pluginID === undefined ||
    (!value.pluginPresentation?.hiddenPluginIDs?.includes(pluginID) &&
      !value.pluginPresentation?.hiddenIDs?.includes(pluginID))
  )
}

export function isPluginMetadataVisible(pluginID: string | undefined, value: AppComposition = composition) {
  return pluginID === undefined || !value.pluginPresentation?.hiddenMetadataPluginIDs?.includes(pluginID)
}

/**
 * The 75+ providers promotion is upstream behavior, so it shows unless a
 * composition opts out. Defaulting it off here would change what a stock build
 * of this fork does, which is a distribution's decision to make, not the
 * fork's.
 */
export function showNewSessionProviderTip(value: AppComposition = composition) {
  return value.newSession?.showProviderTip !== false
}

/** Distributions can use the regular model picker even without a paid provider. */
export function showModelProviderPromotions(value: AppComposition = composition) {
  return value.modelSelector?.showProviderPromotions !== false
}
