import { describe, expect, test } from "bun:test"
import { updaterPlatformKind } from "./select-platform"

describe("updaterPlatformKind", () => {
  test("branded darwin uses the external apply engine", () => {
    expect(
      updaterPlatformKind({
        platform: "darwin",
        appId: "ai.harnez.workbench",
        updaterEnabled: true,
      }),
    ).toBe("external")
  })

  test("branded darwin stays external when the stock updater flag is off", () => {
    expect(
      updaterPlatformKind({
        platform: "darwin",
        appId: "ai.harnez.workbench.beta",
        updaterEnabled: false,
      }),
    ).toBe("external")
  })

  test("unbranded darwin uses electron-updater when enabled", () => {
    expect(
      updaterPlatformKind({
        platform: "darwin",
        appId: undefined,
        updaterEnabled: true,
      }),
    ).toBe("stock")
  })

  test("unbranded darwin is disabled when the stock updater flag is off", () => {
    expect(
      updaterPlatformKind({
        platform: "darwin",
        appId: undefined,
        updaterEnabled: false,
      }),
    ).toBe("none")
  })

  test("branded non-darwin uses electron-updater when enabled", () => {
    expect(
      updaterPlatformKind({
        platform: "win32",
        appId: "ai.harnez.workbench",
        updaterEnabled: true,
      }),
    ).toBe("stock")
  })
})
