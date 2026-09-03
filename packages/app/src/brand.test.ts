import { describe, expect, test } from "bun:test"
import { brandText, resolveSupportLink } from "./brand"

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

describe("resolveSupportLink", () => {
  const STOCK = "https://opencode.ai/desktop-feedback"

  /**
   * An unset define, an empty string, and the literal string "undefined" that a
   * mis-plumbed build define produces all have to land on stock. The starter's
   * generated vite config only emits values the consumer actually set for this
   * reason; this is the second line of defence.
   */
  test("falls back to stock when nothing usable is configured", () => {
    for (const value of [undefined, "", "   ", STOCK]) {
      expect(resolveSupportLink(value)).toEqual({
        url: STOCK,
        labelKey: "error.page.report.discord",
        icon: "discord",
      })
    }
  })

  test("takes a configured http(s) destination, with a neutral label and icon", () => {
    expect(resolveSupportLink("https://help.factory.example/opencode")).toEqual({
      url: "https://help.factory.example/opencode",
      labelKey: "error.page.report.support",
      icon: "help",
    })
    expect(resolveSupportLink("  http://intranet/support  ").url).toBe("http://intranet/support")
  })

  /**
   * The value is handed to `platform.openExternal`, so a scheme the
   * distribution did not mean to set degrades to stock rather than reaching the
   * OS. It is build-time config, not user input, but a typo should not be the
   * thing that decides what gets opened.
   */
  test("ignores anything that is not http(s)", () => {
    for (const value of ["javascript:alert(1)", "file:///etc/passwd", "mailto:help@example.com", "help.example.com"]) {
      expect(resolveSupportLink(value).url).toBe(STOCK)
    }
  })

  test("brands the report prefix, so a custom destination is not attributed to OpenCode", () => {
    expect(brandText("error.page.report.prefix", "Please report this error to the OpenCode team", "Factory")).toBe(
      "Please report this error to the Factory team",
    )
  })
})
