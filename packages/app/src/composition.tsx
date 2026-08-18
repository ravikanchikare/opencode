import type { Component } from "solid-js"
import type { IconProps } from "@opencode-ai/ui/icon"
import type { useLanguage } from "@/context/language"

/**
 * Props a composed Settings panel receives. Shared by the `settingsProviders`
 * slot and by every tab added through `settingsTabs`, so a single component can
 * fill either.
 *
 * `onBack` reopens the dialog on the Providers tab whichever slot receives it.
 * That reads as "back to the list" for the Providers panel; a composed tab that
 * passes it on — to `useProviderConnectController`, say — sends the user to
 * Providers rather than back to that tab, so a tab wanting its own dismissal
 * should pass its own callback.
 */
export type SettingsPanelProps = {
  directory: string | undefined
  onBack?: () => void
}

export type HomeSurfaceProps = {
  openSettings: () => void
}

export type SettingsSurfaceProps = {
  sessionID?: string
  defaultValue?: string
}

export type HomeUtilityNavSurfaceProps = {
  class?: string
  onOpenSettings: () => void
  onOpenHelp: () => void
  language: ReturnType<typeof useLanguage>
}

export type SettingsProvidersSurfaceProps = SettingsPanelProps
export type SettingsTabContentProps = SettingsPanelProps

export type SettingsTabEntry = {
  /** Tab value, unique across stock and composed tabs. */
  value: string
  /** Icon name from the v1 icon set. */
  icon: IconProps["name"]
  /** Label shown in the tab trigger. */
  label: string
  /** Component rendered in the tab content area. */
  content: Component<SettingsTabContentProps>
}

/**
 * Surfaces a distribution may replace. Each slot is optional and independent:
 * an unset slot renders the stock surface, so a composition owns only what it
 * names here.
 *
 * The slots nest. `home` and `settings` replace a whole page or dialog and are
 * read by the router and the settings command; the finer slots below are read
 * only by the stock page or dialog they belong to, so replacing the coarse
 * surface means the finer slot inside it is never consulted and the
 * replacement owns that ground itself.
 */
export type AppComposition = {
  /** Replaces the whole Home page. */
  home?: Component<HomeSurfaceProps>
  /** Replaces the whole Settings dialog. */
  settings?: Component<SettingsSurfaceProps>
  /**
   * Replaces the body of the stock Settings → Providers tab, leaving every
   * other tab, the tab list, and the dialog shell untouched.
   */
  settingsProviders?: Component<SettingsProvidersSurfaceProps>
  /**
   * Replaces the utility nav at the bottom of the Home page's project sidebar
   * and its mobile counterpart. The stock component shows Settings and Help; a
   * composition can omit either.
   */
  homeUtilityNav?: Component<HomeUtilityNavSurfaceProps>
  /**
   * Customizes the stock Settings tab list: hide stock tabs by value and append
   * new tabs after the Capabilities group. Added tab content renders outside
   * `SettingsServerScope`, so a composed tab does not receive a server-scoped
   * directory unless it reads one itself.
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
