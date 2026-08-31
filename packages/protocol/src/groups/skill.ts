import { Skill } from "@opencode-ai/schema/skill"
import { Location } from "@opencode-ai/schema/location"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"
import { SkillNotFoundError } from "../errors.js"
import { LocationQuery, locationQueryOpenApi } from "./location.js"

export const SkillGroup = HttpApiGroup.make("server.skill")
  .add(
    HttpApiEndpoint.get("skill.list", "/api/skill", {
      query: LocationQuery,
      success: Location.response(Schema.Array(Skill.Info)),
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.skill.list",
          summary: "List skills",
          description: "Retrieve currently registered skills.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.get("skill.inventory", "/api/skill/inventory", {
      query: LocationQuery,
      success: Location.response(Schema.Array(Skill.Inventory)),
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.skill.inventory",
          summary: "List skill inventory",
          description: "Retrieve all registered skills and their availability for the selected location.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.put("skill.setEnabled", "/api/skill/:skill/enabled", {
      params: { skill: Skill.ID },
      query: LocationQuery,
      payload: Schema.Union([
        Schema.Struct({ enabled: Schema.Boolean }),
        Schema.Struct({ inherit: Schema.Literal(true) }),
      ]),
      success: HttpApiSchema.NoContent,
      error: SkillNotFoundError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.skill.setEnabled",
          summary: "Set skill availability",
          description:
            "Set the global default, set a location override, or restore inherited availability for a skill.",
        }),
      ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "skill",
      description: "Experimental skill routes.",
    }),
  )
