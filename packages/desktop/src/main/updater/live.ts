export * as UpdaterLive from "./live"

import { app, dialog } from "electron"
import { Effect, Layer, Option } from "effect"
import type { UpdaterState } from "@opencode-ai/app/updater"
import { APP_ID, MANUAL_UPDATE_URL, UPDATER_ENABLED } from "../constants"
import { DesktopInitialization } from "../lifecycle/desktop-initialization"
import { ApplicationLifecycle } from "../lifecycle"
import { nativeT } from "../native/translations"
import { setAppQuitting } from "../windows"
import { make, Service } from "./index"
import { updaterPlatformKind, type UpdaterPlatformKind } from "./select-platform"

const key = "ready"

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const lifecycle = yield* ApplicationLifecycle.Service
    const desktop = yield* DesktopInitialization.Service
    const runFork = Effect.runForkWith(yield* Effect.context())
    const platform = yield* loadPlatform(desktop.version, runFork)
    return yield* make({
      currentVersion: desktop.version,
      platform,
      prepareToRestart: lifecycle.prepareToRestart,
      persistence: {
        get: Effect.sync(() => {
          const value = desktop.updaterStore.get(key)
          if (!value || typeof value !== "object" || !("version" in value) || typeof value.version !== "string") return
          return { version: value.version }
        }),
        set: (value) => Effect.sync(() => desktop.updaterStore.set(key, value)),
        clear: Effect.sync(() => desktop.updaterStore.delete(key)),
      },
      show,
    })
  }),
)

const show = Effect.fn("Updater.show")(function* (
  check: Effect.Effect<UpdaterState>,
  install: Effect.Effect<void, unknown>,
) {
  const state = yield* check
  if (state.status === "error") {
    yield* promise(() =>
      dialog.showMessageBox({
        type: "error",
        message: nativeT("desktop.updater.dialog.checkFailed.message"),
        title: nativeT("desktop.updater.dialog.checkFailed.title"),
      }),
    )
    return
  }
  if (state.status === "up-to-date") {
    yield* promise(() =>
      dialog.showMessageBox({
        type: "info",
        message: nativeT("desktop.updater.dialog.upToDate.message"),
        title: nativeT("desktop.updater.dialog.upToDate.title"),
      }),
    )
    return
  }
  if (state.status !== "ready") return

  const response = yield* promise(() =>
    dialog.showMessageBox({
      type: "info",
      message: nativeT("desktop.updater.dialog.ready.message", { version: state.version }),
      title: nativeT("desktop.updater.dialog.ready.title"),
      buttons: [nativeT("desktop.updater.dialog.restart"), nativeT("desktop.updater.dialog.later")],
      defaultId: 0,
      cancelId: 1,
    }),
  )
  if (response.response === 0) yield* install
})

function promise<A>(evaluate: () => Promise<A>) {
  return Effect.tryPromise(evaluate).pipe(Effect.orDie)
}

type RunFork = (effect: Effect.Effect<unknown, unknown, never>) => unknown

function loadPlatform(currentVersion: string, runFork: RunFork) {
  const kind = updaterPlatformKind({
    platform: process.platform,
    appId: APP_ID,
    updaterEnabled: UPDATER_ENABLED,
  })
  return loadPlatformKind(kind, currentVersion, runFork)
}

/**
 * Terminate the app so the external updater can replace the bundle.
 *
 * `app.quit()` alone does not reliably get there. On a packaged Workbench build
 * it destroys the Node environment and then leaves the process alive in
 * `-[NSApplication run]` with a dead JavaScript loop, so Sparkle waits forever
 * for a termination that never comes and the staged update only lands whenever
 * the process is next killed. The graceful work is already done by this point —
 * the updater awaits `prepareToRestart` before calling this — so escalating to
 * an outright exit is safe, and it is what the default relaunch handler in
 * `windows/index.ts` already does.
 */
function quitForUpdate(runFork: RunFork) {
  runFork(Effect.logInfo("updater requested quit"))
  app.quit()
  const escalate = setTimeout(() => {
    runFork(Effect.logInfo("updater quit did not terminate the app; exiting"))
    app.exit(0)
  }, quitEscalationDelay)
  escalate.unref()
}

const quitEscalationDelay = 3_000

function loadPlatformKind(kind: UpdaterPlatformKind, currentVersion: string, runFork: RunFork) {
  if (kind === "none") return Effect.succeed(undefined)
  if (kind === "external") {
    return Effect.promise(() => import("./external-platform")).pipe(
      Effect.flatMap(({ make }) =>
        make({
          feedUrl: import.meta.env.OPENCODE_DESKTOP_UPDATE_URL,
          publicKey: import.meta.env.OPENCODE_DESKTOP_UPDATE_PUBLIC_KEY,
          currentVersion,
          appPath: app.getPath("exe").replace(/\/Contents\/MacOS\/[^/]+$/, ""),
          packaged: app.isPackaged,
          resourcesPath: process.resourcesPath,
          manualUpdateUrl: MANUAL_UPDATE_URL,
          quit: () => quitForUpdate(runFork),
          setQuitting: setAppQuitting,
        }),
      ),
      Effect.option,
      Effect.map((loaded) => (Option.isSome(loaded) ? loaded.value : undefined)),
    )
  }
  return Effect.promise(() => import("./platform")).pipe(Effect.flatMap(({ make }) => make))
}
