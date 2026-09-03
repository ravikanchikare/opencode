import { describe, expect, test } from "bun:test"
import { showNewSessionProviderTip, type AppComposition } from "@/composition"

describe("new-session provider tip composition", () => {
  test("shows the 75+ providers promotion unless a composition opts out", () => {
    expect(showNewSessionProviderTip({})).toBe(true)
    expect(showNewSessionProviderTip({ newSession: {} })).toBe(true)
    expect(showNewSessionProviderTip({ newSession: { showProviderTip: false } })).toBe(false)
    expect(showNewSessionProviderTip({ newSession: { showProviderTip: true } })).toBe(true)
  })

  test("leaves a stock build on upstream behavior", () => {
    const composition: AppComposition = {}
    expect(composition.newSession).toBeUndefined()
    expect(showNewSessionProviderTip(composition)).toBe(true)
  })
})
