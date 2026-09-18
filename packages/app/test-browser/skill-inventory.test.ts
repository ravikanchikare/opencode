import { expect, test } from "bun:test"
import { createEffect, createMemo, createRoot, createSignal } from "solid-js"
import { currentSkill, type SkillRow } from "../src/settings/extensions/skill-availability"
import { createSkillInventory } from "../src/settings/extensions/skill-inventory"

const skill: SkillRow = {
  id: "review",
  name: "Review",
  location: "/skills/review.md",
  content: "Review changes.",
  enabled: true,
  defaultEnabled: true,
  inherited: true,
}

function setup(input: Pick<Parameters<typeof createSkillInventory>[0], "load" | "save">) {
  return createRoot((dispose) => {
    const errors: string[] = []
    const [scope, setScope] = createSignal<string | false>("@server")
    const inventory = createSkillInventory({
      ...input,
      scope,
      onError: (_error, phase) => errors.push(phase),
    })
    const selected = createMemo(() => currentSkill(inventory.rows(), skill.id))
    return { inventory, selected, errors, setScope, dispose }
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

test("initial failures are recoverable and a failed new scope never borrows old rows", async () => {
  const loads = [
    () => Promise.reject(new Error("offline")),
    () => Promise.resolve([skill]),
    () => Promise.reject(new Error("other project unavailable")),
  ]
  const fixture = setup({
    load: () => loads.shift()!(),
    save: async () => {},
  })
  try {
    await until(() => !fixture.inventory.loading())
    expect(fixture.inventory.rows()).toEqual([])
    expect(fixture.errors).toEqual(["load"])
    await fixture.inventory.refetch()
    expect(fixture.selected()?.id).toBe(skill.id)
    fixture.setScope("/other-project")
    expect(fixture.inventory.rows()).toEqual([])
    await until(() => !fixture.inventory.loading())
    expect(fixture.inventory.rows()).toEqual([])
    expect(fixture.errors).toEqual(["load", "load"])
  } finally {
    fixture.dispose()
  }
})

test("pending spans save and refresh, coalesces duplicate changes, and keeps disabled details selected", async () => {
  const save = Promise.withResolvers<void>()
  const refresh = Promise.withResolvers<SkillRow[]>()
  const calls: (boolean | undefined)[] = []
  const loads = [() => Promise.resolve([skill]), () => refresh.promise]
  const fixture = setup({
    load: () => loads.shift()!(),
    save: async (_scope, _skill, enabled) => {
      calls.push(enabled)
      await save.promise
    },
  })
  try {
    await until(() => !fixture.inventory.loading())
    const operation = fixture.inventory.set(skill, false)
    expect(fixture.inventory.pending()).toBe(skill.id)
    await fixture.inventory.set(skill, true)
    expect(calls).toEqual([false])
    save.resolve()
    await until(() => fixture.inventory.loading())
    expect(fixture.inventory.pending()).toBe(skill.id)
    expect(fixture.selected()).toBe(skill)
    refresh.resolve([{ ...skill, enabled: false, inherited: false }])
    await operation
    expect(fixture.inventory.pending()).toBeUndefined()
    expect(fixture.selected()).toMatchObject({ id: skill.id, enabled: false })
    expect(fixture.errors).toEqual([])
  } finally {
    fixture.dispose()
  }
})

test("refresh and save failures are distinct, retain the inventory, and release pending", async () => {
  const loads = [
    () => Promise.resolve([skill]),
    () => Promise.reject(new Error("refresh failed")),
    () => Promise.resolve([{ ...skill, enabled: false }]),
  ]
  const saves = [() => Promise.resolve(), () => Promise.reject(new Error("save failed"))]
  const fixture = setup({
    load: () => loads.shift()!(),
    save: () => saves.shift()!(),
  })
  try {
    await until(() => !fixture.inventory.loading())
    await fixture.inventory.set(skill, false)
    expect(fixture.errors).toEqual(["refresh"])
    expect(fixture.selected()).toBe(skill)
    expect(fixture.inventory.pending()).toBeUndefined()
    await fixture.inventory.refetch()
    expect(fixture.selected()?.enabled).toBe(false)
    await fixture.inventory.set(skill, true)
    expect(fixture.errors).toEqual(["refresh", "save"])
    expect(fixture.selected()?.enabled).toBe(false)
    expect(fixture.inventory.pending()).toBeUndefined()
  } finally {
    fixture.dispose()
  }
})

test("a scope change during save does not refetch or overwrite the new scope", async () => {
  const save = Promise.withResolvers<void>()
  const loads: string[] = []
  const fixture = setup({
    load: async (scope) => {
      loads.push(scope)
      return scope === "@server" ? [skill] : []
    },
    save: () => save.promise,
  })
  try {
    await until(() => !fixture.inventory.loading())
    const operation = fixture.inventory.set(skill, undefined)
    fixture.setScope("/other-project")
    await until(() => !fixture.inventory.loading())
    save.resolve()
    await operation
    expect(loads).toEqual(["@server", "/other-project"])
    expect(fixture.inventory.rows()).toEqual([])
    expect(fixture.inventory.pending()).toBeUndefined()
  } finally {
    fixture.dispose()
  }
})
