import type { Component } from "solid-js"

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
}

let composition: AppComposition = {}

export function configureAppComposition(value: AppComposition) {
  composition = { ...value }
}

export function getAppComposition() {
  return composition
}
