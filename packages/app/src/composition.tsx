import type { Component } from "solid-js"
import type { IconProps } from "@opencode-ai/ui/icon"
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

export type SettingsTabEntry = {
  value: string
  icon: IconProps["name"]
  label: string
  content: Component<SettingsTabContentProps>
  before?: string
}

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

export type AppComposition = {
  settingsDefaults?: AppSettingsDefaults
  onboarding?: Component<OnboardingSurfaceProps>
  providerConnectionBanner?: Component<ProviderConnectionBannerSurfaceProps>
  settingsProviders?: Component<SettingsProvidersSurfaceProps>
  homeUtilityNav?: Component<HomeUtilityNavSurfaceProps>
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
 * The 75+ providers promotion is upstream behavior, so it shows unless a
 * composition opts out. Defaulting it off here would change what a stock build
 * of this fork does, which is a distribution's decision to make, not the
 * fork's.
 */
export function showNewSessionProviderTip(value: AppComposition = composition) {
  return value.newSession?.showProviderTip !== false
}
