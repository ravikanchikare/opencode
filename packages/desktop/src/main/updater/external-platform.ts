import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { Effect } from "effect"
import type { Platform } from "./index"

export const BRIDGE_NAME = "sparkle-bridge.node"
const restartTimeout = 10_000

export type NativeUpdaterHandle = {
  checkForUpdate(): Promise<string | undefined>
  stageUpdate(): Promise<void>
  installAndRestart(): Promise<void>
  dispose(): void
}

export type NativeUpdaterModule = {
  make(options: {
    feedUrl: string
    publicKey: string
    currentVersion: string
    appPath: string
    manualUpdateUrl?: string
    quit: () => void
    setQuitting: (quitting?: boolean) => void
  }): NativeUpdaterHandle
}

export function resolveBridgePath(input: { packaged: boolean; resourcesPath: string }) {
  if (!input.packaged) return undefined
  return path.join(input.resourcesPath, BRIDGE_NAME)
}

export function wrapNativePlatform(
  handle: NativeUpdaterHandle,
  setQuitting: (quitting?: boolean) => void,
): Platform {
  return {
    checkForUpdate: Effect.tryPromise({
      try: () => handle.checkForUpdate(),
      catch: (error) => error,
    }),
    stageUpdate: Effect.tryPromise({
      try: () => handle.stageUpdate(),
      catch: (error) => error,
    }),
    installAndRestart: Effect.tryPromise({
      try: () => handle.installAndRestart(),
      catch: (error) => error,
    }).pipe(
      Effect.timeoutOrElse({
        duration: restartTimeout,
        orElse: () =>
          Effect.logError("update restart did not start").pipe(
            Effect.andThen(Effect.fail(new Error("Update restart did not start"))),
          ),
      }),
      Effect.tapError(() => Effect.sync(() => setQuitting(false))),
      Effect.andThen(Effect.never),
    ),
    dispose: () => handle.dispose(),
  }
}

export const make = (input: {
  feedUrl: string | undefined
  publicKey: string | undefined
  currentVersion: string
  appPath: string
  packaged: boolean
  resourcesPath: string
  manualUpdateUrl?: string
  quit: () => void
  setQuitting: (quitting?: boolean) => void
  exists?: (file: string) => boolean
  load?: (file: string) => NativeUpdaterModule
}) =>
  Effect.try({
    try: () => {
      const feedUrl = input.feedUrl?.trim()
      if (!feedUrl) throw new Error("OPENCODE_DESKTOP_UPDATE_URL is required for desktop updates")
      const publicKey = input.publicKey?.trim()
      if (!publicKey) throw new Error("OPENCODE_DESKTOP_UPDATE_PUBLIC_KEY is required for desktop updates")
      const bridgePath = resolveBridgePath({
        packaged: input.packaged,
        resourcesPath: input.resourcesPath,
      })
      if (!bridgePath) throw new Error("Updater bridge is only available in a packaged app")
      const exists = input.exists ?? existsSync
      if (!exists(bridgePath)) throw new Error(`Updater bridge is missing at ${bridgePath}`)
      const load = input.load ?? ((file) => createRequire(import.meta.url)(file) as NativeUpdaterModule)
      return wrapNativePlatform(
        load(bridgePath).make({
          feedUrl,
          publicKey,
          currentVersion: input.currentVersion,
          appPath: input.appPath,
          manualUpdateUrl: input.manualUpdateUrl,
          quit: input.quit,
          setQuitting: input.setQuitting,
        }),
        input.setQuitting,
      )
    },
    catch: (error) => error,
  })
