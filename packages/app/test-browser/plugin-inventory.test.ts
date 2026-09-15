import { expect, test } from "bun:test"
import { createEffect, createRoot, createSignal } from "solid-js"
import type { PluginInfo } from "@opencode/client"
import { createPluginInventory } from "../src/settings/extensions/plugin-inventory"

const plugin: PluginInfo = { id: "example", source: { type: "sdk" }, features: {}, state: { status: "active" } }

function setup(load: (scope: string) => Promise<readonly PluginInfo[]>) {
  return createRoot((dispose) => {
    const [scope, setScope] = createSignal<string | false>("server-a")
    return { inventory: createPluginInventory({ scope, load }), setScope, dispose }
  })
}

function until(condition: () => boolean) {
  return new Promise<void>((resolve) =>
    createRoot((dispose) =>
      createEffect(() => {
        if (!condition()) return
        dispose()
        resolve()
      }),
    ),
  )
}

test("pending, loaded-empty, and loaded-with-plugins are distinct", async () => {
  const pending = Promise.withResolvers<PluginInfo[]>()
  const fixture = setup(() => pending.promise)
  try {
    expect(fixture.inventory.loading()).toBe(true)
    expect(fixture.inventory.rows()).toEqual([])
    pending.resolve([])
    await until(() => !fixture.inventory.loading())
    expect(fixture.inventory.error()).toBeUndefined()
    expect(fixture.inventory.rows()).toEqual([])
  } finally {
    fixture.dispose()
  }
})

test("refresh retains rows; errors are recoverable; another scope cannot borrow the inventory", async () => {
  const pending = Promise.withResolvers<PluginInfo[]>()
  const loads = [
    () => Promise.resolve([plugin]),
    () => pending.promise,
    () => Promise.resolve([]),
    () => Promise.reject(new Error("offline")),
  ]
  const fixture = setup(() => loads.shift()!())
  try {
    await until(() => !fixture.inventory.loading())
    expect(fixture.inventory.rows()).toEqual([plugin])
    const refresh = fixture.inventory.refetch()
    expect(fixture.inventory.loading()).toBe(true)
    expect(fixture.inventory.rows()).toEqual([plugin])
    pending.reject(new Error("refresh failed"))
    await refresh
    expect(fixture.inventory.error()).toBe("refresh failed")
    expect(fixture.inventory.rows()).toEqual([plugin])
    await fixture.inventory.refetch()
    expect(fixture.inventory.error()).toBeUndefined()
    expect(fixture.inventory.rows()).toEqual([])
    fixture.setScope("server-b")
    expect(fixture.inventory.loading()).toBe(true)
    expect(fixture.inventory.rows()).toEqual([])
    await until(() => !fixture.inventory.loading())
    expect(fixture.inventory.error()).toBe("offline")
    fixture.setScope(false)
    expect(fixture.inventory.loading()).toBe(true)
    expect(fixture.inventory.rows()).toEqual([])
  } finally {
    fixture.dispose()
  }
})
