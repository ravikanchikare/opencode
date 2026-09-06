import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { Effect } from "effect"
import type { PackagedUpdaterProvider } from "./packaged-provider"
import type { Platform } from "./index"

const restartTimeout = 10_000

/**
 * The contract a packaged updater provider implements.
 *
 * Four promises and a disposer — find a version, stage it, apply it and
 * restart, release resources. The host supplies only what it alone knows
 * (the running version, where the application lives, how to quit), and
 * spreads the manifest's `config` alongside. Everything about how an update
 * is discovered, verified, and applied belongs to the provider.
 */
export type UpdaterProviderHandle = {
  checkForUpdate(): Promise<string | undefined>
  stageUpdate(): Promise<void>
  installAndRestart(): Promise<void>
  dispose(): void
}

export type UpdaterProviderOptions = {
  readonly currentVersion: string
  readonly appPath: string
  readonly manualUpdateUrl?: string
  readonly quit: () => void
  readonly setQuitting: (quitting?: boolean) => void
  /** Every other key is the manifest's `config`, forwarded verbatim. */
  readonly [option: string]: unknown
}

export type UpdaterProviderModule = {
  make(options: UpdaterProviderOptions): UpdaterProviderHandle
}

export function resolveProviderPath(input: { readonly resourcesPath: string; readonly module: string }) {
  return path.join(input.resourcesPath, input.module)
}

export function wrapProviderHandle(
  handle: UpdaterProviderHandle,
  setQuitting: (quitting?: boolean) => void,
): Platform {
  return {
    checkForUpdate: Effect.tryPromise({
      try: () => handle.checkForUpdate(),
      catch: (error) => error,
    }),
    stageUpdate: () =>
      Effect.tryPromise({
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

/**
 * Load the selected provider, or fail with something worth reading.
 *
 * Every failure here names the module, because the only person who can fix it
 * is whoever packaged that module. A provider that is selected and unusable
 * must not degrade into the same state as a build that never wanted updates.
 */
export const make = (input: {
  readonly provider: PackagedUpdaterProvider
  readonly currentVersion: string
  readonly appPath: string
  readonly resourcesPath: string
  readonly manualUpdateUrl?: string
  readonly quit: () => void
  readonly setQuitting: (quitting?: boolean) => void
  readonly exists?: (file: string) => boolean
  readonly load?: (file: string) => UpdaterProviderModule
}) =>
  Effect.try({
    try: () => {
      const module = input.provider.module
      const modulePath = resolveProviderPath({ resourcesPath: input.resourcesPath, module })
      const exists = input.exists ?? existsSync
      if (!exists(modulePath)) throw new Error(`updater provider "${module}" is missing at ${modulePath}`)
      const load = input.load ?? ((file) => createRequire(import.meta.url)(file) as UpdaterProviderModule)
      let loaded: UpdaterProviderModule
      try {
        loaded = load(modulePath)
      } catch (error) {
        throw new Error(`updater provider "${module}" failed to load: ${messageOf(error)}`)
      }
      if (typeof loaded?.make !== "function")
        throw new Error(`updater provider "${module}" does not export make(options)`)
      let handle: UpdaterProviderHandle
      try {
        handle = loaded.make({
          // Provider-defined options first: the host's own fields are not
          // something a manifest gets to replace.
          ...input.provider.config,
          currentVersion: input.currentVersion,
          appPath: input.appPath,
          manualUpdateUrl: input.manualUpdateUrl,
          quit: input.quit,
          setQuitting: input.setQuitting,
        })
      } catch (error) {
        throw new Error(`updater provider "${module}" failed to initialize: ${messageOf(error)}`)
      }
      return wrapProviderHandle(handle, input.setQuitting)
    },
    catch: (error) => error,
  })

export function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
