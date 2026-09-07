import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  configureAppComposition,
  getAppComposition,
  showModelProviderPromotions,
  showNewSessionProviderTip,
  type AppComposition,
} from "@/composition"
import { resolveSupportLink } from "@/brand"
import { defaultSettings, resolveSettingsDefaults } from "@/settings/model"
import { groupSettingsTabs, STOCK_TAB_GROUPS } from "@/settings/tabs"

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

/**
 * The seam is additive: `configureAppComposition({})` must leave a build
 * indistinguishable from upstream. It did not, for a while — the composition
 * commit removed the Manage Models "Connect provider" button, dropped the
 * provider dialog's sizing classes, moved the Home utility nav inside the
 * scroll region, and deleted three translation keys that stock components
 * still reference. None of those was behind an option, and nothing failed.
 */
describe("an empty composition is upstream", () => {
  test("declares no surface, no defaults, and no tab changes", () => {
    configureAppComposition({})
    const composition = getAppComposition()
    expect(composition.settingsProviders).toBeUndefined()
    expect(composition.homeUtilityNav).toBeUndefined()
    expect(composition.onboarding).toBeUndefined()
    expect(composition.providerConnectionBanner).toBeUndefined()
    expect(composition.settingsDefaults).toBeUndefined()
    expect(composition.settingsTabs).toBeUndefined()
    expect(composition.pluginOptionLabels).toBeUndefined()
  })

  test("keeps stock settings defaults", () => {
    expect(resolveSettingsDefaults(undefined)).toBe(defaultSettings)
  })

  test("keeps the stock support link", () => {
    expect(resolveSupportLink(undefined)).toEqual({
      url: "https://opencode.ai/desktop-feedback",
      labelKey: "error.page.report.discord",
      icon: "discord",
    })
    expect(resolveSupportLink("https://opencode.ai/desktop-feedback")).toEqual(resolveSupportLink(undefined))
    // A non-http value is not a support link; fall back rather than render it.
    expect(resolveSupportLink("javascript:alert(1)")).toEqual(resolveSupportLink(undefined))
  })

  test("keeps the stock settings tab grouping", () => {
    expect(groupSettingsTabs([], new Set())).toEqual(STOCK_TAB_GROUPS.map((group) => [...group]))
  })
})

/**
 * Translation keys are strings on both sides: nothing relates a `language.t`
 * call to a dictionary entry, so deleting an entry a stock component still
 * uses is silent, and the UI renders the raw key. That is exactly what
 * happened to `settings.extensions.manageConfig`, `addSkills`, and
 * `project.settings.extensions.shared`.
 *
 * Hebrew is the trap here — it is easy to restore `en` and forget `he`, and
 * nothing else in the suite would notice. Both dictionaries are checked.
 */
describe("stock components' translation keys resolve", () => {
  const root = join(import.meta.dir)
  const components = [
    "settings/providers/extensions.tsx",
    "settings/workspaces/project-extensions.tsx",
    "settings/extensions/panels.tsx",
  ]

  const referenced = components.flatMap((file) => {
    const source = readFileSync(join(root, file), "utf8")
    return [...source.matchAll(/language\.t\(\s*"([^"]+)"/g)].map((match) => ({ file, key: match[1]! }))
  })

  const dictionaryOf = (locale: string) => {
    const source = readFileSync(join(root, "runtime/i18n", `${locale}.ts`), "utf8")
    return new Set([...source.matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1]!))
  }

  test("finds the keys to check at all", () => {
    // A regex that matched nothing would make every assertion below vacuous.
    expect(referenced.length).toBeGreaterThan(4)
    expect(referenced.map((item) => item.key)).toContain("settings.extensions.manageConfig")
    expect(referenced.map((item) => item.key)).toContain("project.settings.extensions.shared")
  })

  for (const locale of ["en", "he"]) {
    test(`every key a stock extension view uses exists in ${locale}`, () => {
      const dictionary = dictionaryOf(locale)
      const missing = referenced.filter((item) => !dictionary.has(item.key)).map((item) => `${item.key} (${item.file})`)
      expect(missing).toEqual([])
    })
  }
})

describe("model selector provider promotions", () => {
  test("preserves stock promotions and permits a distribution to opt out", () => {
    expect(showModelProviderPromotions({})).toBe(true)
    expect(showModelProviderPromotions({ modelSelector: {} })).toBe(true)
    expect(showModelProviderPromotions({ modelSelector: { showProviderPromotions: true } })).toBe(true)
    expect(showModelProviderPromotions({ modelSelector: { showProviderPromotions: false } })).toBe(false)
  })
})
