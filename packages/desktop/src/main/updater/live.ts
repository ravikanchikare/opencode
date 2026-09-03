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
    const platform = yield* loadPlatform(desktop.version)
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

function loadPlatform(currentVersion: string) {
  const kind = updaterPlatformKind({
    platform: process.platform,
    appId: APP_ID,
    updaterEnabled: UPDATER_ENABLED,
  })
  return loadPlatformKind(kind, currentVersion)
}

function loadPlatformKind(kind: UpdaterPlatformKind, currentVersion: string) {
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
          quit: () => app.quit(),
          setQuitting: setAppQuitting,
        }),
      ),
      Effect.option,
      Effect.map((loaded) => (Option.isSome(loaded) ? loaded.value : undefined)),
    )
  }
  return Effect.promise(() => import("./platform")).pipe(Effect.flatMap(({ make }) => make))
}
