import { createSignal, onCleanup, Show, type JSX } from "solid-js"
import { Portal } from "solid-js/web"

// Each view's panel ends with a slot; the newest one mounted is the visible
// panel (Settings opens over the routed view), so the footer follows it and
// falls back when it closes.
const [slots, setSlots] = createSignal<readonly HTMLElement[]>([])

/**
 * A footer mount point, placed as the last child of a view's panel. It is an
 * in-flow, inset row that centres its content, so a footer takes its own height
 * inside the panel instead of covering the page, and collapses when empty.
 */
export function ShellFooterSlot() {
  let element!: HTMLDivElement
  queueMicrotask(() => setSlots((list) => [...list, element]))
  onCleanup(() => setSlots((list) => list.filter((item) => item !== element)))
  return (
    <div
      ref={element}
      data-slot="shell-footer"
      // A portal leaves its wrapper behind, so "empty" means that wrapper has
      // no children; the slot then takes no space and draws no fade.
      class="mt-auto flex w-full flex-none justify-center p-3 [&:not(:has(>*>*))]:hidden"
    />
  )
}

/**
 * Renders children in the visible panel's footer slot, so they take their own
 * height below the page content instead of floating over it. Renders nothing
 * until a panel with a slot has mounted.
 */
export function ShellFooter(props: { children: JSX.Element }) {
  const mount = () => slots().at(-1)
  return (
    <Show when={mount()} keyed>
      {(element) => <Portal mount={element}>{props.children}</Portal>}
    </Show>
  )
}
