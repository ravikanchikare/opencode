import { beforeAll, describe, expect, test } from "bun:test"
import { runInNewContext } from "node:vm"
import { fileURLToPath } from "node:url"
import { notificationIcon } from "../../../scripts/notification-icon"
import type { createDesktopNotify } from "./notifications"

const icon = notificationIcon(undefined, "prod")
const compiled = { code: "" }

beforeAll(async () => {
  const result = await Bun.build({
    entrypoints: [fileURLToPath(new URL("./notifications.ts", import.meta.url))],
    target: "browser",
    format: "cjs",
    define: { "import.meta.env.OPENCODE_NOTIFICATION_ICON": JSON.stringify(icon) },
  })
  expect(result.success).toBe(true)
  compiled.code = await result.outputs[0].text()
})

function fixture(focused: boolean | Error, documentFocused = false) {
  const events: string[] = []
  const notifications: BrowserNotification[] = []
  class BrowserNotification {
    onclick?: () => void
    constructor(
      readonly title: string,
      readonly options: NotificationOptions,
    ) {
      notifications.push(this)
    }
    close() {
      events.push("close")
    }
  }
  // Exercise the compiled browser entry in an isolated realm, without replacing
  // process globals or adding notification injection hooks to production.
  const module = { exports: {} as { createDesktopNotify: typeof createDesktopNotify } }
  runInNewContext(compiled.code, {
    module,
    exports: module.exports,
    Notification: BrowserNotification,
    document: { hasFocus: () => documentFocused },
  })
  const notify = module.exports.createDesktopNotify({
    getWindowFocused: async () => {
      if (focused instanceof Error) throw focused
      return focused
    },
    showWindow: async () => {
      events.push("show")
    },
    setWindowFocus: async () => {
      events.push("focus")
    },
  } as Parameters<typeof createDesktopNotify>[0])
  return { notify, notifications, events }
}

describe("desktop notifications", () => {
  test("embeds the selected icon and preserves click behavior", async () => {
    const state = fixture(false)
    await state.notify("Response ready", "Session title", () => {
      state.events.push("navigate")
    })
    expect(state.notifications).toHaveLength(1)
    expect(state.notifications[0].title).toBe("Response ready")
    expect(state.notifications[0].options).toEqual({ body: "Session title", icon, silent: true })
    state.notifications[0].onclick?.()
    expect(state.events).toEqual(["show", "focus", "navigate", "close"])
    expect(compiled.code).not.toContain("https://opencode.ai/favicon")
  })

  test("suppresses notifications while focused", async () => {
    const state = fixture(true)
    await state.notify("Response ready")
    expect(state.notifications).toHaveLength(0)
  })

  test.each([true, false])("uses document focus if the native focus query fails: %s", async (focused) => {
    const state = fixture(new Error("window unavailable"), focused)
    await state.notify("Error")
    expect(state.notifications).toHaveLength(focused ? 0 : 1)
  })

  test("allows an omitted body and click callback", async () => {
    const state = fixture(false)
    await state.notify("Error")
    expect(state.notifications[0].options.body).toBe("")
    state.notifications[0].onclick?.()
    expect(state.events).toEqual(["show", "focus", "close"])
  })
})
