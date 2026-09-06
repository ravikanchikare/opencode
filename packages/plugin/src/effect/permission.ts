import type { PermissionApi } from "@opencode/client/effect/api"
import type { Agent } from "@opencode/schema/agent"
import type { Permission } from "@opencode/schema/permission"
import type { Session } from "@opencode/schema/session"
import type { Tool } from "@opencode/schema/tool"
import type { Effect } from "effect"
import type { Hooks } from "./registration.js"

export interface PermissionAssertInput {
  readonly sessionID: Session.ID
  readonly agent?: Agent.ID
  readonly action: string
  readonly resources: ReadonlyArray<string>
  readonly save?: ReadonlyArray<string>
  readonly message?: string
  readonly metadata?: Record<string, unknown>
  readonly source?: Permission.Source
}

export interface PermissionEvaluation {
  readonly sessionID: Session.ID
  readonly agent?: Agent.ID
  readonly action: string
  readonly resources: ReadonlyArray<string>
  readonly metadata?: Record<string, unknown>
  readonly source?: Permission.Source
  effect: Permission.Effect
  message?: string
}

export interface PermissionHooks {
  readonly evaluate: PermissionEvaluation
}

export type PermissionDomain = Pick<PermissionApi<unknown>, "list" | "get" | "reply" | "rules"> & {
  readonly assert: (input: PermissionAssertInput) => Effect.Effect<void, Tool.Error>
  readonly hook: Hooks<PermissionHooks>
}
