import { Location } from "@opencode-ai/schema/location"
import { Plugin } from "@opencode-ai/schema/plugin"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"
import { PluginLockedError, PluginNotFoundError } from "../errors.js"
import { LocationQuery, locationQueryOpenApi } from "./location.js"

export const PluginGroup = HttpApiGroup.make("server.plugin")
  .add(
    HttpApiEndpoint.get("plugin.list", "/api/plugin", {
      query: LocationQuery,
      success: Location.response(Schema.Array(Plugin.Info)),
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.plugin.list",
          summary: "List plugins",
          description: "Retrieve the server plugin inventory and each plugin's current activation status.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.put("plugin.setEnabled", "/api/plugin/:plugin/enabled", {
      params: { plugin: Plugin.ID },
      query: LocationQuery,
      payload: Schema.Union([
        Schema.Struct({ enabled: Schema.Boolean }),
        Schema.Struct({ inherit: Schema.Literal(true) }),
      ]),
      success: HttpApiSchema.NoContent,
      error: [PluginNotFoundError, PluginLockedError],
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.plugin.setEnabled",
          summary: "Set plugin availability",
          description:
            "Set the global default, set a location override, or restore inherited availability for a user-toggleable plugin.",
        }),
      ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "plugin",
      description: "Experimental plugin routes.",
    }),
  )
