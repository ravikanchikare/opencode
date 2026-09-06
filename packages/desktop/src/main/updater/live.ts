export * as UpdaterLive from "./live"

import { app, dialog } from "electron"
import { Effect, Layer } from "effect"
import type { UpdaterState } from "@opencode-ai/app/updater"
import { MANUAL_UPDATE_URL, updaterSelection } from "../constants"
import { DesktopInitialization } from "../lifecycle/desktop-initialization"
import { ApplicationLifecycle } from "../lifecycle"
import { nativeT } from "../native/translations"
import { setAppQuitting } from "../windows"
import { make, Service, type Platform } from "./index"
import type { UpdaterSelection } from "./selection"

const key = "ready"

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const lifecycle = yield* ApplicationLifecycle.Service
    const desktop = yield* DesktopInitialization.Service
    const runFork = Effect.runForkWith(yield* Effect.context())
    const loaded = yield* loadUpdater(updaterSelection(), desktop.version, runFork)
    return yield* make({
      currentVersion: desktop.version,
      ...loaded,
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

/**
 * What `Updater.make` needs to know about the selected updater.
 *
 * Exactly one of these is set, or neither. `unavailable` is the case the
 * previous implementation lost: it wrapped the load in `Effect.option` and
 * mapped a failure to `undefined`, which is the same value a build with no
 * updater at all produces. A distribution whose provider failed to load then
 * saw "Updates are disabled" and had nothing to go on.
 */
type LoadedUpdater = { readonly platform?: Platform; readonly unavailable?: string }

/**
 * Terminate the app so an updater provider can replace the bundle.
 *
 * `app.quit()` alone does not reliably get there. On a packaged desktop build
 * it destroys the Node environment and then leaves the process alive in
 * `-[NSApplication run]` with a dead JavaScript loop, so a provider waiting on
 * termination waits forever and the staged update only lands whenever the
 * process is next killed. The graceful work is already done by this point —
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

function loadUpdater(
  selection: UpdaterSelection,
  currentVersion: string,
  runFork: RunFork,
): Effect.Effect<LoadedUpdater> {
  if (selection.kind === "disabled") return Effect.succeed({})
  if (selection.kind === "unavailable") return unavailable(selection.message, runFork)
  if (selection.kind === "stock")
    return Effect.promise(() => import("./platform")).pipe(
      Effect.flatMap(({ make }) => make),
      Effect.map((platform) => ({ platform })),
    )
  const provider = selection.provider
  return Effect.tryPromise(() => import("./provider-platform")).pipe(
    Effect.flatMap(({ make }) =>
      make({
        provider,
        currentVersion,
        appPath: app.getPath("exe").replace(/\/Contents\/MacOS\/[^/]+$/, ""),
        resourcesPath: process.resourcesPath,
        manualUpdateUrl: MANUAL_UPDATE_URL,
        quit: () => quitForUpdate(runFork),
        setQuitting: setAppQuitting,
      }),
    ),
    Effect.map((platform) => ({ platform }) as LoadedUpdater),
    Effect.catch((error) =>
      unavailable(error instanceof Error ? error.message : String(error), runFork),
    ),
  )
}

function unavailable(message: string, runFork: RunFork): Effect.Effect<LoadedUpdater> {
  runFork(Effect.logError("updater provider unavailable", { message }))
  return Effect.succeed({ unavailable: message })
}
