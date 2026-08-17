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

export type SettingsTabContentProps = {
  directory: string | undefined
  onBack?: () => void
}

export type SettingsTabEntry = {
  /** Tab value, unique across stock and composed tabs. */
  value: string
  /** Icon name from the fork's v1 icon set. */
  icon: string
  /** Label shown in the tab trigger. */
  label: string
  /** Component rendered in the tab content area. */
  content: Component<SettingsTabContentProps>
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
  /**
   * Customizes the stock Settings tab list: hide stock tabs by value and
   * append new tabs after the Capabilities group. Only `dialog-settings-v2.tsx`
   * consults this — a composition that also replaces `settings` owns its own
   * dialog and this slot is not read. Added tab content is rendered outside
   * `SettingsServerScope`, so composed tabs do not receive a server-scoped
   * directory unless they read one themselves.
   */
  settingsTabs?: {
    hide?: readonly string[]
    add?: readonly SettingsTabEntry[]
  }
}

let composition: AppComposition = {}

export function configureAppComposition(value: AppComposition) {
  composition = { ...value }
}

export function getAppComposition() {
  return composition
}
