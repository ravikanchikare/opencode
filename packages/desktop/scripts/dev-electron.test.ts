import { expect, test } from "bun:test"
import { join } from "node:path"
import { devElectronIconPath, devElectronIdentity } from "./dev-electron"

test("uses the stock development Electron identity when distribution branding is unset", () => {
  expect(devElectronIdentity({})).toEqual({
    name: "OpenCode Dev",
    appId: "ai.opencode.desktop.dev",
  })
})

test("uses distribution branding for the development Electron bundle", () => {
  expect(
    devElectronIdentity({
      OPENCODE_DESKTOP_NAME: "Factory Local",
      OPENCODE_DESKTOP_APP_ID: "ai.factory.desktop.local",
    }),
  ).toEqual({
    name: "Factory Local",
    appId: "ai.factory.desktop.local",
  })
})

test("uses the stock icon when distribution branding is unset", () => {
  const icon = join(import.meta.dirname, "../icons/dev/icon.icns")
  expect(devElectronIconPath({})).toBe(icon)
  expect(devElectronIconPath({ OPENCODE_DESKTOP_ICON_DIR: "  " })).toBe(icon)
})

test("uses the distribution icon for the development Electron bundle", () => {
  expect(
    devElectronIconPath({
      OPENCODE_DESKTOP_ICON_DIR: " /assets/example-distribution/icons ",
    }),
  ).toBe(join("/assets/example-distribution/icons", "icon.icns"))
})

test("ignores blank distribution branding values", () => {
  expect(
    devElectronIdentity({
      OPENCODE_DESKTOP_NAME: "  ",
      OPENCODE_DESKTOP_APP_ID: "\t",
    }),
  ).toEqual({
    name: "OpenCode Dev",
    appId: "ai.opencode.desktop.dev",
  })
})
