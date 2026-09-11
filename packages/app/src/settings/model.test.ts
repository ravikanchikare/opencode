import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { timelinePresets } from "@opencode/session-ui/timeline/detail"
import { Persistence } from "@/runtime/persistence/schema"
import {
  settingsSchema,
  settingsPersistence,
  defaultSettings,
  resolveSettingsDefaults,
  monoDefault,
  monoFontFamily,
  sansDefault,
  sansFontFamily,
  terminalFontFamily,
} from "./model"

const schema = Persistence.withInitial(settingsPersistence, defaultSettings)
const decode = Schema.decodeUnknownSync(schema)
const encode = Schema.encodeSync(schema)

describe("settings timeline detail migration", () => {
  test("migrates saved switches and round trips the current settings", () => {
    const settings = decode({
      general: { shellToolPartsExpanded: true, editToolPartsExpanded: false, showReasoningSummaries: true },
      experiments: { fontSize: 16 },
    })
    expect(settings.general.timelineDetail).toEqual({
      ...timelinePresets[2].value,
      shell: { placement: "separate", details: "expanded" },
      thinking: { placement: "separate", details: "expanded" },
    })
    expect(settings.experiments.fontSize).toBe(16)
    expect(decode(encode(settings))).toEqual(settings)
  })
})

describe("settings schema", () => {
  test("restores summary expansion and discards the retired status preference", () => {
    const settings = decode({
      general: { showStatus: true, showSearch: true },
      sessionSummary: { projectExpanded: false, serverExpanded: true },
    })
    expect(settings.general.showSearch).toBe(true)
    expect(settings.general).not.toHaveProperty("showStatus")
    expect(settings.sessionSummary).toEqual({ projectExpanded: false, serverExpanded: true })
    expect(decode(encode(settings)).sessionSummary).toEqual(settings.sessionSummary)
  })

  test("merges distribution defaults without changing stock defaults", () => {
    expect(resolveSettingsDefaults({ general: { followUpBehavior: "queue" } })).toMatchObject({
      general: { followUpBehavior: "queue", autoSave: true },
      experiments: defaultSettings.experiments,
    })
    expect(defaultSettings.general.followUpBehavior).toBe("steer")
  })

  test("uses the supplied initial values independently of the current schema", () => {
    const initial = {
      ...defaultSettings,
      general: { ...defaultSettings.general, timelineDetail: timelinePresets[4].value, autoSave: false },
      experiments: { ...defaultSettings.experiments, fontSize: 20 },
    }
    const restore = Schema.decodeUnknownSync(Persistence.withInitial(settingsPersistence, initial))
    expect(restore({})).toEqual(initial)
    expect(restore({ general: { reasoningMode: "invalid", showReasoningSummaries: true } })).toEqual(initial)
    expect(restore({ general: { showReasoningSummaries: true } }).general.timelineDetail.thinking).toEqual({
      placement: "separate",
      details: "expanded",
    })
    expect(() => Schema.decodeUnknownSync(settingsSchema)({})).toThrow()
  })

  test("supplies the existing defaults for an empty document", () => {
    expect(decode({})).toEqual({
      general: {
        autoSave: true,
        releaseNotes: true,
        showFileTree: false,
        showNavigation: false,
        showSearch: false,
        showProjectIcon: false,
        showTerminal: false,
        timelineDetail: timelinePresets[2].value,
        showCustomAgents: false,
        mobileTitlebarPosition: "top",
        mobileDiffWrap: true,
        terminalPlacement: "side",
        followUpBehavior: "steer",
      },
      sessionSummary: { projectExpanded: true, serverExpanded: true },
      experiments: {
        fontSize: 14,
        mono: "",
        sans: "",
        terminal: "",
        tabLayout: "horizontal",
        showProjectName: false,
      },
      keybinds: {},
      permissions: { autoApprove: false },
      workspaces: { defaultDestination: "last-used", lastUsed: {} },
      notifications: { agent: true, permissions: true, errors: false },
      sounds: {
        agentEnabled: true,
        agent: "staplebops-01",
        permissionsEnabled: true,
        permissions: "staplebops-02",
        errorsEnabled: true,
        errors: "nope-03",
      },
    })
  })

  test("defaults invalid preferences locally while retaining valid siblings", () => {
    const settings = decode({
      general: {
        showTerminal: true,
        autoSave: false,
        releaseNotes: undefined,
        reasoningMode: 3,
        followUpBehavior: "invalid",
      },
      experiments: { fontSize: "large", mono: "Custom Mono", tabLayout: "vertical", showProjectName: true },
      permissions: { autoApprove: true },
      workspaces: { defaultDestination: "new", lastUsed: { good: "workspace", bad: true } },
      keybinds: { good: "ctrl+k", bad: 3 },
      notifications: { agent: false, permissions: "yes", errors: true },
      sounds: { agent: "custom", agentEnabled: false, permissions: 3 },
    })
    expect(settings.general).toMatchObject({
      showTerminal: true,
      autoSave: false,
      releaseNotes: true,
      timelineDetail: timelinePresets[2].value,
      followUpBehavior: "steer",
    })
    expect(settings.experiments).toEqual({
      fontSize: 14,
      mono: "Custom Mono",
      sans: "",
      terminal: "",
      tabLayout: "vertical",
      showProjectName: true,
    })
    expect(settings.permissions.autoApprove).toBe(true)
    expect(settings.workspaces).toEqual({ defaultDestination: "new", lastUsed: { good: "workspace" } })
    expect(settings.keybinds).toEqual({ good: "ctrl+k" })
    expect(settings.notifications).toEqual({ agent: false, permissions: true, errors: true })
    expect(settings.sounds).toMatchObject({ agent: "custom", agentEnabled: false, permissions: "staplebops-02" })
    expect(decode(encode(settings))).toEqual(settings)
  })

  test("migrates the appearance preference section to experiments", () => {
    expect(decode({ appearance: { tabLayout: "vertical" } }).experiments.tabLayout).toBe("vertical")
  })

  test.each([undefined, null, false, 7, "invalid", []].map((invalid) => [invalid]))(
    "defaults malformed sections without losing other sections: %j",
    (invalid) => {
      const defaults = decode({})
      expect(
        decode({
          general: invalid,
          experiments: { fontSize: 18 },
          keybinds: invalid,
          permissions: invalid,
          workspaces: invalid,
          notifications: invalid,
          sounds: invalid,
        }),
      ).toEqual({
        ...defaults,
        experiments: { ...defaults.experiments, fontSize: 18 },
      })
    },
  )

  test("does not silently repair invalid values during encoding", () => {
    expect(() =>
      Schema.encodeUnknownSync(settingsSchema)({ ...decode({}), experiments: { fontSize: "large" } }),
    ).toThrow()
  })
})

describe("settings font families", () => {
  test("defaults normal text to Inter", () => {
    expect(sansDefault).toBe("Inter")
    expect(sansFontFamily(undefined)).toStartWith('"Inter", ')
    expect(sansFontFamily("")).toStartWith('"Inter", ')
    expect(sansFontFamily("   ")).toStartWith('"Inter", ')
  })

  test("keeps custom normal fonts ahead of the default", () => {
    expect(sansFontFamily("Custom Sans")).toStartWith('"Custom Sans", "Inter", ')
  })

  test("defaults monospace text to IBM Plex Mono", () => {
    expect(monoDefault).toBe("IBM Plex Mono")
    expect(monoFontFamily(undefined)).toStartWith('"IBM Plex Mono", ')
    expect(monoFontFamily("")).toStartWith('"IBM Plex Mono", ')
    expect(monoFontFamily("   ")).toStartWith('"IBM Plex Mono", ')
  })

  test("keeps custom monospace fonts ahead of the default", () => {
    expect(monoFontFamily("Custom Mono")).toStartWith('"Custom Mono", "IBM Plex Mono", ')
  })

  test("preserves the separate terminal font default", () => {
    expect(terminalFontFamily(undefined)).toStartWith('"JetBrainsMono Nerd Font Mono", ')
  })
})
