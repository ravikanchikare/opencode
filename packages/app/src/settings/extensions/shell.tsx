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
import { createStore } from "solid-js/store"
import { Icon, type IconProps } from "@opencode/ui/icon"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import type { InventoryGroup } from "./presentation"
import { SettingsGroup } from "@/settings/group"
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
  description?: string
  descriptionLines?: 2
  detail?: string
  mono?: boolean
  onOpen?: () => void
  children?: JSX.Element
  documentationUrl?: string
}> = (props) => {
  const language = useLanguage()
  const platform = usePlatform()
  return (
    <div
      class="extension-destination-row"
      classList={{ "extension-destination-row-open": !!props.onOpen }}
      role={props.onOpen ? "button" : undefined}
      tabIndex={props.onOpen ? 0 : undefined}
      onClick={props.onOpen}
      onKeyDown={(event) => {
        if (!props.onOpen || event.currentTarget !== event.target || (event.key !== "Enter" && event.key !== " "))
          return
        event.preventDefault()
        props.onOpen()
      }}
    >
      <div class="extension-destination-label">
        <Icon name={props.icon} class="extension-destination-icon" />
        <span class="extension-destination-main">
          <span class="extension-destination-name-line">
            <span class="extension-destination-name" classList={{ mono: props.mono }}>
              {props.name}
            </span>
            <Show when={props.documentationUrl}>
              <button
                type="button"
                class="extension-destination-learn-more"
                aria-label={language.t("settings.extensions.learnMore")}
                title={language.t("settings.extensions.learnMore")}
                onClick={(event) => {
                  event.stopPropagation()
                  platform.openExternal(props.documentationUrl!)
                }}
              >
                <Icon name="help" size="small" />
              </button>
            </Show>
          </span>
          <Show when={props.description}>
            <span
              class="extension-destination-description"
              classList={{ "extension-destination-description-clamp-2": props.descriptionLines === 2 }}
            >
              {props.description}
            </span>
          </Show>
          <Show when={props.detail}>
            <span class="extension-destination-description">{props.detail}</span>
          </Show>
        </span>
      </div>
      <Show when={props.children}>
        <div class="extension-destination-controls" onClick={(event) => event.stopPropagation()}>
          {props.children}
        </div>
      </Show>
    </div>
  )
}

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

export function ExtensionSections<T>(props: {
  sections: readonly InventoryGroup<T>[]
  empty: string
  children: (item: T) => JSX.Element
}): JSX.Element {
  const [store, setStore] = createStore({ collapsed: {} as Record<string, boolean> })
  return (
    <div class="settings-section-stack">
      <For each={props.sections}>
        {(section) => (
          <div class="settings-section">
            <Show when={section.group}>
              {(group) => (
                <SettingsGroup
                  expanded={!store.collapsed[group().id]}
                  onExpandedChange={(expanded) => setStore("collapsed", group().id, !expanded)}
                >
                  <span class="settings-group-label">
                    <span class="settings-group-title">{group().title}</span>
                    <Show when={group().description}>
                      {(description) => <span class="extension-destination-description">{description()}</span>}
                    </Show>
                  </span>
                </SettingsGroup>
              )}
            </Show>
            <Show when={!section.group || !store.collapsed[section.group.id]}>
              <ExtensionList each={section.rows} empty={props.empty}>
                {props.children}
              </ExtensionList>
            </Show>
          </div>
        )}
      </For>
    </div>
  )
}

/** A destination's outer frame: header, then native section spacing. */
export const ExtensionDestination: Component<{
  title: string
  description: string
  children: JSX.Element
  /** The caller already supplies a stack of settings sections. */
  sectioned?: boolean
}> = (props) => (
  <>
    <ExtensionHeader title={props.title} description={props.description} />
    <div class="settings-tab-body extension-destination">
      <Show when={props.sectioned} fallback={<div class="settings-section">{props.children}</div>}>
        {props.children}
      </Show>
    </div>
  </>
)
