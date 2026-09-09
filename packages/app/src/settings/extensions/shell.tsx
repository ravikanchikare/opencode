/**
 * Chrome for an extension **destination** — a full Settings tab showing one
 * domain — as opposed to the combined Extensions tab's inner pills.
 *
 * Kept separate from the pill layout on purpose. A composition that presents
 * MCP, Plugins, Skills and Integrations as four destinations is making a
 * navigation choice, and it should not have to restate what a row looks like to
 * make it; equally, adopting these rows must not change the combined tab, which
 * is what a stock build still shows.
 */

import { For, Show, type Component, type JSX } from "solid-js"
import { Dynamic } from "solid-js/web"
import { Icon, type IconProps } from "@opencode/ui/icon"
import "./extensions.css"

export const ExtensionHeader: Component<{ title: string; description: string }> = (props) => (
  <div class="settings-tab-header">
    <div class="settings-tab-header-row">
      <div class="extension-destination-heading">
        <h2 class="settings-tab-title">{props.title}</h2>
        <span class="extension-destination-description">{props.description}</span>
      </div>
    </div>
  </div>
)

export const ExtensionRow: Component<{
  icon: IconProps["name"]
  name: string
  detail?: string
  mono?: boolean
  onOpen?: () => void
  children?: JSX.Element
}> = (props) => (
  <div class="extension-destination-row">
    <Dynamic
      component={props.onOpen ? "button" : "div"}
      type={props.onOpen ? "button" : undefined}
      class="extension-destination-label"
      onClick={props.onOpen}
    >
      <Icon name={props.icon} class="extension-destination-icon" />
      <span class="extension-destination-main">
        <span class="extension-destination-name" classList={{ mono: props.mono }}>
          {props.name}
        </span>
        <Show when={props.detail}>
          <span class="extension-destination-description">{props.detail}</span>
        </Show>
      </span>
    </Dynamic>
    {props.children}
  </div>
)

export function ExtensionList<T>(props: {
  each: readonly T[] | undefined
  empty: string
  children: (item: T) => JSX.Element
}): JSX.Element {
  return (
    <div class="extension-destination-list">
      <Show when={props.each?.length} fallback={<div class="settings-provider-empty">{props.empty}</div>}>
        <For each={props.each}>{(item) => props.children(item)}</For>
      </Show>
    </div>
  )
}

/** A destination's outer frame: header, then one section of rows. */
export const ExtensionDestination: Component<{
  title: string
  description: string
  children: JSX.Element
}> = (props) => (
  <>
    <ExtensionHeader title={props.title} description={props.description} />
    <div class="settings-tab-body extension-destination">
      <div class="settings-section">{props.children}</div>
    </div>
  </>
)
