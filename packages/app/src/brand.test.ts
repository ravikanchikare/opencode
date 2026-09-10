import { describe, expect, test } from "bun:test"
import { dict } from "./runtime/i18n/en"
import {
  brandText,
  resolveSupportLink,
  DEFAULT_PRODUCT_NAME,
  IDENTITY_KEYS,
  LITERAL_KEYS,
} from "./brand"

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


/**
 * The classification must stay exhaustive.
 *
 * An unclassified key is invisible: a branded build simply keeps saying
 * "OpenCode" in that one string, and nobody finds out until a user sees two
 * product names in the same window. Upstream adds and rewords copy constantly,
 * so this is checked against the catalog rather than maintained by memory.
 */
describe("product-name classification", () => {
  const catalog = Object.entries(dict).filter(([, value]) => value.includes(DEFAULT_PRODUCT_NAME))

  test("classifies every catalog string that names the product", () => {
    const unclassified = catalog
      .map(([key]) => key)
      .filter((key) => !IDENTITY_KEYS.has(key) && !LITERAL_KEYS.has(key))
    expect(unclassified).toEqual([])
  })

  test("classifies no key that the catalog does not have", () => {
    const known = new Set(catalog.map(([key]) => key))
    const stale = [...IDENTITY_KEYS, ...LITERAL_KEYS].filter((key) => !known.has(key))
    expect(stale).toEqual([])
  })

  test("classifies no key as both", () => {
    expect([...IDENTITY_KEYS].filter((key) => LITERAL_KEYS.has(key))).toEqual([])
  })
})
