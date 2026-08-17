import type { Component } from "solid-js"
import type { useLanguage } from "@/context/language"

export type HomeSurfaceProps = {
  openSettings: () => void
}

export type SettingsSurfaceProps = {
  sessionID?: string
  defaultValue?: string
}

export type SettingsProvidersSurfaceProps = {
  directory: string | undefined
  onBack?: () => void
}

export type HomeUtilityNavSurfaceProps = {
  class?: string
  onOpenSettings: () => void
  onOpenHelp: () => void
  language: ReturnType<typeof useLanguage>
}

export type AppComposition = {
  home?: Component<HomeSurfaceProps>
  settings?: Component<SettingsSurfaceProps>
  /**
   * Replaces the body of the stock Settings → Providers tab, leaving every
   * other tab, the tab list, and the dialog shell untouched. Only the stock
   * settings dialog consults this; a composition that also replaces `settings`
   * owns its own tab bodies and this slot is not read.
   */
  settingsProviders?: Component<SettingsProvidersSurfaceProps>
  /**
   * Replaces the utility nav rendered at the bottom of the Home page's project
   * sidebar (and its mobile counterpart). The stock component shows Settings
   * and Help buttons; a composition can omit either. Only `home.tsx`
   * consults this — a composition that also replaces `home` owns its own
   * entire page and this slot is not read.
   */
  homeUtilityNav?: Component<HomeUtilityNavSurfaceProps>
}

let composition: AppComposition = {}

export function configureAppComposition(value: AppComposition) {
  composition = { ...value }
}

export function getAppComposition() {
  return composition
}
