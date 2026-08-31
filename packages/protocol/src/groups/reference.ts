import { Location } from "@opencode-ai/schema/location"
import { Reference } from "@opencode-ai/schema/reference"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { LocationQuery, locationQueryOpenApi } from "./location.js"

export const ReferenceGroup = HttpApiGroup.make("server.reference")
  .add(
    HttpApiEndpoint.get("reference.list", "/api/reference", {
      query: LocationQuery,
      success: Location.response(Schema.Array(Reference.Info)),
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.reference.list",
          summary: "List references",
          description: "List references available in the requested location.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.get("reference.catalog", "/api/reference/catalog", {
      query: LocationQuery,
      success: Location.response(Reference.Catalog),
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.reference.catalog",
          summary: "Get reference catalog",
          description: "Return candidate repositories, selection state, and access status.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.post("reference.check", "/api/reference/catalog/check", {
      query: LocationQuery,
      payload: Schema.Struct({ ids: Schema.Array(Schema.String) }),
      success: Location.response(Reference.Catalog),
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.reference.check",
          summary: "Check reference access",
          description: "Validate access to candidate repositories without selecting or cloning them.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.put("reference.select", "/api/reference/catalog/selection", {
      query: LocationQuery,
      payload: Reference.Selection,
      success: Location.response(Reference.Catalog),
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.reference.select",
          summary: "Select references",
          description: "Persist the enabled candidate repositories and materialize their local caches.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.post("reference.refresh", "/api/reference/catalog/refresh", {
      query: LocationQuery,
      payload: Schema.Struct({ ids: Schema.Array(Schema.String).pipe(Schema.optional) }),
      success: Location.response(Reference.Catalog),
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.reference.refresh",
          summary: "Refresh references",
          description: "Force a refresh of selected candidate repository caches.",
        }),
      ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "reference",
      description: "Location-scoped project references.",
    }),
  )
