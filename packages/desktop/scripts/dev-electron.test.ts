import { expect, test } from "bun:test"
import { devElectronIdentity } from "./dev-electron"

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
