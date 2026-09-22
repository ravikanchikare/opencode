import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  configureAppComposition,
  getAppComposition,
  isPluginVisible,
  modelVisibilityDefault,
  showManageModelsConnectProvider,
  showModelProviderPromotions,
  showNewSessionProviderTip,
  type AppComposition,
} from "@/composition"
import { resolveSupportLink } from "@/brand"
import { defaultSettings, resolveSettingsDefaults } from "@/settings/model"
import { composeSettingsNavGroups } from "@/settings/tabs"
import type { SettingsNavGroup } from "@/settings/navigation"

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

describe("manage-models provider connection composition", () => {
  test("shows the connection action unless a composition opts out", () => {
    expect(showManageModelsConnectProvider({})).toBe(true)
    expect(showManageModelsConnectProvider({ modelSelector: {} })).toBe(true)
    expect(showManageModelsConnectProvider({ modelSelector: { showConnectProvider: false } })).toBe(false)
    expect(showManageModelsConnectProvider({ modelSelector: { showConnectProvider: true } })).toBe(true)
  })
})

describe("model visibility defaults composition", () => {
  const arcus = {
    modelSelector: { defaultVisibleModels: { litellm: ["claude-sonnet-5"] } },
  } satisfies AppComposition

  test("applies defaults only to configured providers", () => {
    expect(modelVisibilityDefault({ providerID: "litellm", modelID: "claude-sonnet-5" }, arcus)).toBe(true)
    expect(modelVisibilityDefault({ providerID: "litellm", modelID: "other" }, arcus)).toBe(false)
    expect(modelVisibilityDefault({ providerID: "anthropic", modelID: "claude-sonnet-5" }, arcus)).toBeUndefined()
    expect(modelVisibilityDefault({ providerID: "litellm", modelID: "other" }, {})).toBeUndefined()
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
    expect(composition.onboarding).toBeUndefined()
    expect(composition.providerConnectionBanner).toBeUndefined()
    expect(composition.settingsDefaults).toBeUndefined()
    expect(composition.settingsTabs).toBeUndefined()
    expect(composition.pluginOptionLabels).toBeUndefined()
    expect(composition.pluginPresentation).toBeUndefined()
  })

  test("keeps stock settings defaults", () => {
    expect(resolveSettingsDefaults(undefined)).toBe(defaultSettings)
  })

  test("keeps upstream debug tools available outside development builds", async () => {
    const source = await Bun.file(join(import.meta.dir, "shell/shell.tsx")).text()
    expect(source).toContain('command.register("debug-bar"')
    expect(source).toContain('id: "debugBar.toggle"')
    expect(source).toContain("<Show when={state.debugTools}>")
    expect(source).toContain("<DebugBar diagnostics={import.meta.env.DEV} inline />")
    expect(source).not.toContain("const debugTools = import.meta.env.DEV")
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
    const groups: SettingsNavGroup[] = [
      { items: [{ value: "general", label: "General", icon: "sliders" }] },
      { label: "Servers", items: [{ value: "server:alpha", label: "alpha", icon: "server" }] },
    ]
    expect(composeSettingsNavGroups(groups, getAppComposition().settingsTabs)).toEqual(groups)
  })
})

describe("plugin inventory presentation", () => {
  test("keeps identified, third-party, and diagnostic plugin rows visible by default", () => {
    expect(isPluginVisible("third-party.plugin", {})).toBe(true)
    expect(isPluginVisible(undefined, {})).toBe(true)
  })

  test("hides only explicitly listed, identified plugin IDs", () => {
    const composition: AppComposition = {
      pluginPresentation: { hiddenIDs: ["factory.packaged"] },
    }
    expect(isPluginVisible("factory.packaged", composition)).toBe(false)
    expect(isPluginVisible("third-party.plugin", composition)).toBe(true)
    expect(isPluginVisible(undefined, composition)).toBe(true)
  })
})

/**
 * Translation keys are strings on both sides: nothing relates a `language.t`
 * call to a dictionary entry, so deleting an entry a stock component still
 * uses is silent, and the UI renders the raw key. That is exactly what
 * happened to `settings.extensions.manageConfig`, `addSkills`, and
 * `project.settings.extensions.shared`.
 *
 * Non-English dictionaries use the runtime's English fallback while new
 * translations await language review.
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
    test(`every key a stock extension view uses resolves in ${locale} with English fallback`, () => {
      const dictionary = new Set([...dictionaryOf("en"), ...dictionaryOf(locale)])
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
