import type { ReferenceApi } from "@opencode-ai/client/promise/api"
import type { ReferenceCandidate, ReferenceGitSource, ReferenceLocalSource } from "@opencode-ai/client"
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

export interface ReferenceDomain extends ReferenceApi {
  readonly transform: Transform<ReferenceDraft>
  readonly reload: () => Promise<void>
}
