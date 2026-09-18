import { describe, expect, test } from "bun:test"
import { DESKTOP_MENU, desktopMenuVisible, parseHiddenDesktopMenuActions } from "./desktop-menu"

describe("desktop menu", () => {
  test("installs the CLI from the macOS application menu", () => {
    const appMenu = DESKTOP_MENU.find((menu) => menu.id === "app")
    const item = appMenu?.items?.find((entry) => entry.type === "item" && entry.action === "app.installCli")

    expect(item).toEqual({ type: "item", labelKey: "desktop.menu.installCli", action: "app.installCli" })
    expect(desktopMenuVisible(item!, "macos")).toBe(true)
  })

  test("parses a comma-separated hide list", () => {
    expect([...parseHiddenDesktopMenuActions()]).toEqual([])
    expect([...parseHiddenDesktopMenuActions("  ")]).toEqual([])
    expect([...parseHiddenDesktopMenuActions("app.installCli, app.checkForUpdates")]).toEqual([
      "app.installCli",
      "app.checkForUpdates",
    ])
  })

  test("hides configured actions from the application menu", () => {
    const hidden = parseHiddenDesktopMenuActions("app.installCli")
    const appMenu = DESKTOP_MENU.find((menu) => menu.id === "app")
    const visible = appMenu?.items?.filter((entry) => desktopMenuVisible(entry, "macos", hidden))

    expect(visible?.some((entry) => entry.type === "item" && entry.action === "app.installCli")).toBe(false)
    expect(visible?.some((entry) => entry.type === "item" && entry.action === "app.checkForUpdates")).toBe(true)
  })

  test("exports logs through the desktop command registry", () => {
    const items = DESKTOP_MENU.flatMap((menu) => menu.items ?? []).filter(
      (item) => item.type === "item" && item.labelKey === "desktop.menu.exportLogs",
    )

    expect(items).toHaveLength(2)
    expect(items.every((item) => item.type === "item" && item.command === "logs.export" && !item.action)).toBe(true)
  })

  test("provides translated labels for role-backed entries", () => {
    const windowMenu = DESKTOP_MENU.find((menu) => menu.role === "windowMenu")
    const roleItems = DESKTOP_MENU.flatMap((menu) => menu.items ?? []).filter(
      (item) => item.type === "item" && item.role && item.labelKey,
    )

    expect(windowMenu?.labelKey).toBe("desktop.menu.window")
    expect(roleItems.length).toBeGreaterThan(0)
  })
})
