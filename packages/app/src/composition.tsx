import type { Component } from "solid-js"

export type HomeSurfaceProps = {
  openSettings: () => void
}

export type SettingsSurfaceProps = {
  sessionID?: string
  defaultValue?: string
}

export type AppComposition = {
  home?: Component<HomeSurfaceProps>
  settings?: Component<SettingsSurfaceProps>
}

let composition: AppComposition = {}

export function configureAppComposition(value: AppComposition) {
  composition = { ...value }
}

export function getAppComposition() {
  return composition
}
