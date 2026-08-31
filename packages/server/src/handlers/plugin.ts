import { ExtensionEnablement } from "@opencode-ai/core/extension-enablement"
import { Plugin } from "@opencode-ai/core/plugin"
import { PluginSupervisor } from "@opencode-ai/core/plugin/supervisor"
import { PluginLockedError, PluginNotFoundError } from "@opencode-ai/protocol/errors"
import { Effect } from "effect"
import { HttpServerRequest } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiSchema } from "effect/unstable/httpapi"
import { Api } from "../api"
import { hasLocationQuery, response } from "../location"

export const PluginHandler = HttpApiBuilder.group(Api, "server.plugin", (handlers) =>
  handlers
    .handle("plugin.list", () =>
      Effect.gen(function* () {
        const supervisor = yield* PluginSupervisor.Service
        yield* supervisor.flush
        const scope = hasLocationQuery(yield* HttpServerRequest.HttpServerRequest)
          ? ("location" as const)
          : ("default" as const)
        return yield* response(
          Effect.gen(function* () {
            const plugin = yield* Plugin.Service
            const enablement = yield* ExtensionEnablement.Service
            const items = yield* plugin.list()
            return yield* Effect.forEach(items, (item) =>
              item.id === undefined || item.state.status === "failed" || !isToggleable(item)
                ? Effect.succeed(item)
                : enablement.state("plugin", item.id, scope).pipe(
                    Effect.map((state) => ({
                      ...item,
                      inherited: state.inherited,
                      defaultEnabled: state.defaultEnabled,
                    })),
                  ),
            )
          }),
        )
      }),
    )
    .handle(
      "plugin.setEnabled",
      Effect.fn(function* (ctx) {
        const supervisor = yield* PluginSupervisor.Service
        yield* supervisor.flush
        const plugin = yield* Plugin.Service
        const info = (yield* plugin.list()).find((item) => item.id === ctx.params.plugin)
        if (!info)
          return yield* new PluginNotFoundError({
            plugin: ctx.params.plugin,
            message: `Plugin not found: ${ctx.params.plugin}`,
          })
        if (!isToggleable(info))
          return yield* new PluginLockedError({
            plugin: ctx.params.plugin,
            message: `Plugin cannot be disabled: ${ctx.params.plugin}`,
          })
        const enablement = yield* ExtensionEnablement.Service
        const enabled = "enabled" in ctx.payload ? ctx.payload.enabled : undefined
        if (hasLocationQuery(yield* HttpServerRequest.HttpServerRequest)) {
          yield* enablement.setOverride("plugin", ctx.params.plugin, enabled)
        } else {
          yield* enablement.setDefault("plugin", ctx.params.plugin, enabled ?? true)
        }
        yield* supervisor.reload
        return HttpApiSchema.NoContent.make()
      }),
    ),
)

function isToggleable(plugin: Plugin.Info) {
  return plugin.source.type === "package" || plugin.source.type === "local" || plugin.source.type === "managed"
}
