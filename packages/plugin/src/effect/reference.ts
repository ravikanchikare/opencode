import type { ReferenceCandidate, ReferenceGitSource, ReferenceLocalSource } from "@opencode-ai/client"
import type { ReferenceApi } from "@opencode-ai/client/effect/api"
import type { Effect } from "effect"
import type { Transform } from "./registration.js"

export interface ReferenceDraft {
  add(name: string, source: ReferenceLocalSource | ReferenceGitSource): void
  remove(name: string): void
  list(): readonly (readonly [string, ReferenceLocalSource | ReferenceGitSource])[]
  readonly candidate: {
    add(candidate: ReferenceCandidate): void
    remove(id: string): void
    list(): readonly ReferenceCandidate[]
  }
}

export interface ReferenceDomain extends ReferenceApi<unknown> {
  readonly transform: Transform<ReferenceDraft>
  readonly reload: () => Effect.Effect<void>
}
