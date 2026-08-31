import { Reference } from "@opencode-ai/core/reference"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { response } from "../location"

export const ReferenceHandler = HttpApiBuilder.group(Api, "server.reference", (handlers) =>
  handlers
    .handle("reference.list", () => response(Reference.Service.use((reference) => reference.list())))
    .handle("reference.catalog", () => response(Reference.Service.use((reference) => reference.catalog())))
    .handle("reference.check", ({ payload }) =>
      response(Reference.Service.use((reference) => reference.check(payload.ids))),
    )
    .handle("reference.select", ({ payload }) =>
      response(
        Reference.Service.use((reference) =>
          Effect.gen(function* () {
            yield* reference.select(payload)
            return yield* reference.catalog()
          }),
        ),
      ),
    )
    .handle("reference.refresh", ({ payload }) =>
      response(
        Reference.Service.use((reference) =>
          Effect.gen(function* () {
            yield* reference.refresh(payload.ids)
            return yield* reference.catalog()
          }),
        ),
      ),
    ),
)
