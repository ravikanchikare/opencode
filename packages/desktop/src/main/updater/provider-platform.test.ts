import { describe, expect, test } from "bun:test"
import { Effect, Exit, Fiber } from "effect"
import { make, resolveProviderPath, type UpdaterProviderOptions } from "./provider-platform"

function fakeModule(calls: string[], seen: UpdaterProviderOptions[]) {
  return {
    make(options: UpdaterProviderOptions) {
      seen.push(options)
      calls.push(`make:${String(options["feedUrl"])}:${options.currentVersion}`)
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

function baseInput(calls: string[], seen: UpdaterProviderOptions[] = []) {
  return {
    provider: { module: "updater.node", config: { feedUrl: "https://example.test/appcast.xml" } },
    currentVersion: "1.0.0",
    appPath: "/Applications/Example.app",
    resourcesPath: "/app/Contents/Resources",
    manualUpdateUrl: "https://example.test/example.dmg",
    quit: () => {
      calls.push("quit")
    },
    setQuitting: () => {
      calls.push("quitting")
    },
    exists: () => true,
    load: () => fakeModule(calls, seen),
  }
}

const failureMessage = async (input: Parameters<typeof make>[0]) => {
  const exit = await Effect.runPromiseExit(make(input))
  expect(Exit.isFailure(exit)).toBe(true)
  return String(Exit.isFailure(exit) ? ((exit.cause as any).error ?? exit.cause) : "")
}

describe("packaged updater provider", () => {
  test("resolves the module inside the packaged resources", () => {
    expect(resolveProviderPath({ resourcesPath: "/app/Contents/Resources", module: "updater.node" })).toBe(
      "/app/Contents/Resources/updater.node",
    )
  })

  /**
   * The host contributes what only it knows and passes `config` through
   * untouched. Nothing here names a feed URL, a key, or a channel — a provider
   * that needs those reads them from its own config.
   */
  test("forwards config verbatim beside the host's own options", async () => {
    const calls: string[] = []
    const seen: UpdaterProviderOptions[] = []
    const platform = await Effect.runPromise(make(baseInput(calls, seen)))

    expect(seen[0]).toMatchObject({
      feedUrl: "https://example.test/appcast.xml",
      currentVersion: "1.0.0",
      appPath: "/Applications/Example.app",
      manualUpdateUrl: "https://example.test/example.dmg",
    })
    expect(await Effect.runPromise(platform.checkForUpdate)).toBe("2.0.0")
    await Effect.runPromise(platform.stageUpdate)
    platform.dispose()
    expect(calls).toEqual(["make:https://example.test/appcast.xml:1.0.0", "check", "stage", "dispose"])
  })

  test("a manifest cannot replace the host's own callbacks", async () => {
    const calls: string[] = []
    const seen: UpdaterProviderOptions[] = []
    const input = baseInput(calls, seen)
    await Effect.runPromise(
      make({
        ...input,
        provider: { module: "updater.node", config: { ...input.provider.config, appPath: "/tmp/evil.app" } },
      }),
    )
    expect(seen[0]!.appPath).toBe("/Applications/Example.app")
  })

  test("forwards installAndRestart before the process is expected to die", async () => {
    const calls: string[] = []
    const platform = await Effect.runPromise(make(baseInput(calls)))
    const fiber = Effect.runFork(platform.installAndRestart)
    await new Promise((resolve) => setTimeout(resolve, 0))
    await Effect.runPromise(Fiber.interrupt(fiber))
    expect(calls).toEqual(["make:https://example.test/appcast.xml:1.0.0", "install", "quitting", "quit"])
  })

  /**
   * Every failure below used to be swallowed into `undefined` by `live.ts` and
   * presented as "Updates are disabled". Each must name the module, because
   * the only person who can fix it packaged that module.
   */
  test("a missing module names the path it looked at", async () => {
    const message = await failureMessage({ ...baseInput([]), exists: () => false })
    expect(message).toContain("updater.node")
    expect(message).toContain("/app/Contents/Resources/updater.node")
    expect(message).toContain("missing")
  })

  test("a module that will not load says so", async () => {
    const message = await failureMessage({
      ...baseInput([]),
      load: () => {
        throw new Error("dlopen(): symbol not found")
      },
    })
    expect(message).toContain('updater provider "updater.node" failed to load')
    expect(message).toContain("dlopen(): symbol not found")
  })

  test("a module without make(options) is an incompatible provider", async () => {
    const message = await failureMessage({ ...baseInput([]), load: () => ({}) as never })
    expect(message).toContain("does not export make(options)")
  })

  test("a provider that throws while initializing says so", async () => {
    const message = await failureMessage({
      ...baseInput([]),
      load: () =>
        ({
          make() {
            throw new Error("feedUrl and appPath are required")
          },
        }) as never,
    })
    expect(message).toContain('updater provider "updater.node" failed to initialize')
    expect(message).toContain("feedUrl and appPath are required")
  })
})
