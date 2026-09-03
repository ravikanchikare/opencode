import { app } from "electron"
import { Context, Effect, FileSystem, Layer, Path } from "effect"
import type { ServerReadyData } from "../../shared/ipc-contract"
import { BackgroundServiceState } from "./background-service-state"
import { APP_IDENTITY, SERVICE_ID } from "../constants"
import { configureManagedPlugins } from "../managed-plugins"
import { cleanStages, DesktopCli } from "./desktop-cli"

export * as BackgroundService from "./background-service"

export interface Interface {
  readonly connection: Effect.Effect<ServerReadyData>
  readonly reconnect: Effect.Effect<ServerReadyData>
}

export class Service extends Context.Service<Service, Interface>()("opencode/desktop/BackgroundService") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const context = yield* Effect.context<FileSystem.FileSystem | Path.Path | DesktopCli.Service>()
    return Service.of(
      yield* BackgroundServiceState.make({
        initial: connect("initial").pipe(Effect.provide(context)),
        reconnect: connect("reconnect").pipe(Effect.provide(context), Effect.orDie),
      }),
    )
  }),
)

const connect = Effect.fn("BackgroundService.connect")(function* (mode: "initial" | "reconnect") {
  yield* Effect.logInfo("starting v2 background service")
  const path = yield* Path.Path
  const desktopCli = yield* DesktopCli.Service
  const runFork = Effect.runForkWith(yield* Effect.context())
  const isolated = !app.isPackaged && process.env.OPENCODE_DESKTOP_ISOLATED_SERVER === "1"
  const cli = yield* desktopCli.resolve
  const version = mode === "initial" ? cli.version : undefined
  if (isolated) process.env.XDG_STATE_HOME = app.getPath("userData")
  const managed = yield* Effect.sync(() =>
    configureManagedPlugins({
      packaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      source: process.env.OPENCODE_DESKTOP_MANAGED_PLUGIN_DIR,
    }),
  )
  if (managed.length > 0) yield* Effect.logInfo("configured managed plugins", { count: managed.length })
  const client = yield* Effect.promise(() => import("@opencode-ai/client/service"))
  const service = yield* Effect.tryPromise(() =>
    client.Service.ensure({
      file:
        isolated && process.env.OPENCODE_DESKTOP_SERVER_CHANNEL === "local"
          ? path.join(app.getPath("userData"), APP_IDENTITY, client.registrationFilename("local", SERVICE_ID))
          : undefined,
      version,
      command: [...cli.command, "serve", "--service", ...(isolated ? ["--port", "0"] : [])],
      onStart: (reason, previousVersion) =>
        runFork(Effect.logInfo("v2 CLI background service starting", { reason, previousVersion })),
    }),
  )
  if (service.auth?.type !== "basic") throw new Error("V2 CLI background service did not provide authentication")
  const url = new URL(service.url)
  if (url.hostname === "0.0.0.0") url.hostname = "127.0.0.1"
  yield* Effect.logInfo("v2 CLI background service ready", {
    username: service.auth.username,
    version,
    ...endpoint(url.origin),
  })
  if (mode === "initial" && isolated && cli.binary) yield* cleanStages(cli.binary).pipe(Effect.orDie)
  return {
    url: url.origin,
    password: service.auth.password,
  } satisfies ServerReadyData
})

function endpoint(url: string | undefined) {
  if (!url || !URL.canParse(url)) return {}
  const parsed = new URL(url)
  return { url, hostname: parsed.hostname, port: parsed.port }
}
