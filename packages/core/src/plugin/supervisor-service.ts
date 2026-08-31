export * as PluginSupervisor from "./supervisor-service.js"

import { Context, Effect } from "effect"

export interface Interface {
  readonly flush: Effect.Effect<void>
  readonly reload: Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/PluginSupervisor") {}
