import { describe, expect, test } from "bun:test"
import { Effect, Fiber, Option } from "effect"
import { BRIDGE_NAME, make, resolveBridgePath } from "./external-platform"

function fakeModule(calls: string[]) {
  return {
    make(options: {
      feedUrl: string
      publicKey: string
      currentVersion: string
      appPath: string
      manualUpdateUrl?: string
      quit: () => void
      setQuitting: (quitting?: boolean) => void
    }) {
      calls.push(`make:${options.feedUrl}:${options.publicKey}:${options.currentVersion}`)
      return {
        checkForUpdate: async () => {
          calls.push("check")
          return "2.0.0"
        },
        stageUpdate: async () => {
          calls.push("stage")
        },
        installAndRestart: async () => {
          calls.push("install")
          options.setQuitting(true)
          options.quit()
        },
        dispose: () => {
          calls.push("dispose")
        },
      }
    },
  }
}

function baseInput(calls: string[]) {
  return {
    feedUrl: "https://example.test/appcast.xml",
    publicKey: "public-key",
    currentVersion: "1.0.0",
    appPath: "/Applications/Workbench.app",
    packaged: true,
    resourcesPath: "/app/Contents/Resources",
    manualUpdateUrl: "https://example.test/workbench.dmg",
    quit: () => {
      calls.push("quit")
    },
    setQuitting: () => {
      calls.push("quitting")
    },
    exists: () => true,
    load: () => fakeModule(calls),
  }
}

describe("external updater platform", () => {
  test("resolves the packaged bridge under Resources", () => {
    expect(resolveBridgePath({ packaged: false, resourcesPath: "/app/Contents/Resources" })).toBeUndefined()
    expect(resolveBridgePath({ packaged: true, resourcesPath: "/app/Contents/Resources" })).toBe(
      `/app/Contents/Resources/${BRIDGE_NAME}`,
    )
  })

  test("forwards check and stage to the native module", async () => {
    const calls: string[] = []
    const platform = await Effect.runPromise(make(baseInput(calls)))

    expect(await Effect.runPromise(platform.checkForUpdate)).toBe("2.0.0")
    await Effect.runPromise(platform.stageUpdate)
    platform.dispose()

    expect(calls).toEqual([
      "make:https://example.test/appcast.xml:public-key:1.0.0",
      "check",
      "stage",
      "dispose",
    ])
  })

  test("forwards installAndRestart before the process is expected to die", async () => {
    const calls: string[] = []
    const platform = await Effect.runPromise(make(baseInput(calls)))
    const fiber = Effect.runFork(platform.installAndRestart)
    await new Promise((resolve) => setTimeout(resolve, 0))
    await Effect.runPromise(Fiber.interrupt(fiber))

    expect(calls).toEqual(["make:https://example.test/appcast.xml:public-key:1.0.0", "install", "quitting", "quit"])
  })

  test("missing bridge is a failed load, not a stock fallback", async () => {
    const loaded = await Effect.runPromise(
      make({
        ...baseInput([]),
        exists: () => false,
      }).pipe(Effect.option),
    )
    expect(Option.isNone(loaded)).toBe(true)
  })

  test("unpackaged apps do not look for a bridge", async () => {
    const loaded = await Effect.runPromise(
      make({
        ...baseInput([]),
        packaged: false,
      }).pipe(Effect.option),
    )
    expect(Option.isNone(loaded)).toBe(true)
  })
})
