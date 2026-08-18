import { describe, expect, test } from "bun:test"
import { brandText } from "./brand"

describe("brandText", () => {
  test("keeps stock copy when no product override is active", () => {
    expect(brandText("app.name.desktop", "OpenCode Desktop", "OpenCode")).toBe("OpenCode Desktop")
  })

  test("renames the strings that name the application itself", () => {
    expect(brandText("app.name.desktop", "OpenCode Desktop", "Factory")).toBe("Factory Desktop")
    expect(brandText("desktop.recovery.unresponsive", "OpenCode is not responding", "Factory")).toBe(
      "Factory is not responding",
    )
  })

  test("leaves OpenCode and its ecosystem visible everywhere else", () => {
    expect(brandText("dialog.model.zen.description", "OpenCode Zen gives you access to models.", "Factory")).toBe(
      "OpenCode Zen gives you access to models.",
    )
    expect(brandText("wsl.onboarding.installOpencode", "Install OpenCode", "Factory")).toBe("Install OpenCode")
    expect(
      brandText("dialog.server.description", "Switch which OpenCode server this app connects to.", "Factory"),
    ).toBe("Switch which OpenCode server this app connects to.")
  })
})
