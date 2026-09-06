import { Plugin } from "@opencode/core/plugin"
import { PluginOptionConfig } from "@opencode/core/plugin/option-config"
import { PluginUpdate } from "@opencode/core/plugin/update"
import { InvalidRequestError, PluginNotFoundError, ServiceUnavailableError } from "@opencode/protocol/errors"
import { Cause, Effect, Exit } from "effect"
import { HttpServerRequest } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { hasLocationQuery, response } from "../location"

const scoped = Effect.fn("plugin.scopedInventory")(function* () {
  const plugins = yield* Plugin.Service
  const options = yield* PluginOptionConfig.Service
  const scope = hasLocationQuery(yield* HttpServerRequest.HttpServerRequest) ? ("location" as const) : ("default" as const)
  yield* plugins.awaitActivation
  const inventory = yield* plugins.list()
  return {
    scope,
    inventory: yield* Effect.forEach(inventory, (info) => options.view(info, scope)),
  }
})

export const PluginHandler = HttpApiBuilder.group(Api, "server.plugin", (handlers) =>
  handlers
    .handle("plugin.list", () =>
      Effect.gen(function* () {
        const options = yield* PluginOptionConfig.Service
        const scope = hasLocationQuery(yield* HttpServerRequest.HttpServerRequest)
          ? ("location" as const)
          : ("default" as const)
        return yield* response(
          Plugin.Service.use((plugin) => plugin.list()).pipe(
            Effect.flatMap((inventory) => Effect.forEach(inventory, (info) => options.view(info, scope))),
          ),
        )
      }),
    )
    .handle("plugin.awaitActivation", () => Plugin.awaitActivation)
    .handle("plugin.check", (ctx) =>
      Effect.gen(function* () {
        const plugins = yield* Plugin.Service
        yield* plugins.awaitActivation
        const inventory = yield* plugins.list()
        const targets = [
          ...new Set(inventory.flatMap((plugin) => (plugin.source.type === "package" ? [plugin.source.target] : []))),
        ].filter((target) => ctx.payload.target === undefined || target === ctx.payload.target)
        if (ctx.payload.target !== undefined && !targets.length)
          return yield* new InvalidRequestError({
            message: `Plugin package is not in the current server inventory: ${ctx.payload.target}`,
            field: "target",
          })
        const updates = yield* PluginUpdate.Service
        const outdated = new Map(
          yield* Effect.forEach(
            targets,
            (target) => updates.check(target, { refresh: true }).pipe(Effect.map((value) => [target, value] as const)),
            { concurrency: "unbounded" },
          ),
        )
        return yield* response(
          Effect.succeed(
            inventory.map((plugin) => {
              if (plugin.source.type !== "package" || !outdated.has(plugin.source.target)) return plugin
              return {
                ...plugin,
                source: {
                  type: "package" as const,
                  target: plugin.source.target,
                  ...(plugin.source.version ? { version: plugin.source.version } : {}),
                  ...(outdated.get(plugin.source.target) ? { outdated: true as const } : {}),
                  ...(plugin.source.updating ? { updating: true as const } : {}),
                },
              }
            }),
          ),
        )
      }),
    )
    .handle("plugin.setOptions", (ctx) =>
      Effect.gen(function* () {
        const { scope, inventory } = yield* scoped()
        const current = inventory.find((plugin) => plugin.id === ctx.params.plugin)
        if (!current)
          return yield* new PluginNotFoundError({
            plugin: ctx.params.plugin,
            message: `Plugin not found: ${ctx.params.plugin}`,
          })
        const descriptor = current.options?.descriptors.find((item) => item.key === ctx.payload.key)
        if (!descriptor)
          return yield* new InvalidRequestError({
            message: `Plugin option is not configurable: ${ctx.payload.key}`,
            field: "key",
          })
        const value = "value" in ctx.payload ? ctx.payload.value : undefined
        const options = yield* PluginOptionConfig.Service
        yield* options.set(ctx.params.plugin, ctx.payload.key, value, scope, current.options?.descriptors).pipe(
          Effect.mapError((error) => new InvalidRequestError({ message: error.message, field: "value" })),
        )
        const plugins = yield* Plugin.Service
        yield* Effect.sleep("200 millis")
        yield* plugins.awaitActivation
        const refreshed = (yield* scoped()).inventory.find((plugin) => plugin.id === ctx.params.plugin)
        if (!refreshed)
          return yield* new PluginNotFoundError({
            plugin: ctx.params.plugin,
            message: `Plugin not found after applying options: ${ctx.params.plugin}`,
          })
        return yield* response(Effect.succeed(refreshed))
      }),
    )
    .handle("plugin.update", (ctx) =>
      Effect.gen(function* () {
        const plugins = yield* Plugin.Service
        yield* plugins.awaitActivation
        const inventory = new Set(
          (yield* plugins.list()).flatMap((plugin) => (plugin.source.type === "package" ? [plugin.source.target] : [])),
        )
        const unknown = ctx.payload.targets.filter((target) => !inventory.has(target))
        if (unknown.length)
          return yield* new InvalidRequestError({
            message: `Plugin packages are not in the current server inventory: ${unknown.join(", ")}`,
            field: "targets",
          })
        const updates = yield* PluginUpdate.Service
        // Let every update run to completion instead of interrupting the rest on the first failure.
        const failures = yield* Effect.forEach(
          ctx.payload.targets,
          (target) =>
            updates.update(target).pipe(
              Effect.exit,
              Effect.map((exit) => (Exit.isFailure(exit) ? [`${target}: ${Cause.pretty(exit.cause)}`] : [])),
            ),
          { concurrency: "unbounded" },
        ).pipe(Effect.map((results) => results.flat()))
        if (failures.length)
          return yield* new ServiceUnavailableError({
            message: `Failed to update plugin packages: ${failures.join("; ")}`,
            service: "plugin",
          })
      }),
    ),
)
