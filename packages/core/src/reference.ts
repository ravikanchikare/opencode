export * as Reference from "./reference.js"

import { makeLocationNode } from "@opencode-ai/util/effect/app-node"
import { Context, Effect, Layer, Option, Schema, Scope, Types } from "effect"
import { Reference } from "@opencode-ai/schema/reference"
import { Global } from "@opencode-ai/util/global"
import { Bus } from "./bus.js"
import { KV } from "./kv.js"
import { Repository } from "./repository.js"
import { RepositoryCache } from "./repository-cache.js"
import { AbsolutePath } from "./schema.js"
import { State } from "./state.js"

export const LocalSource = Reference.LocalSource
export type LocalSource = Reference.LocalSource

export const GitSource = Reference.GitSource
export type GitSource = Reference.GitSource

export const Source = Reference.Source
export type Source = Reference.Source

export const Candidate = Reference.Candidate
export type Candidate = Reference.Candidate

export const Catalog = Reference.Catalog
export type Catalog = Reference.Catalog

export const Selection = Reference.Selection
export type Selection = Reference.Selection

export { Event } from "@opencode-ai/schema/reference"

export const Info = Reference.Info
export type Info = Reference.Info

type Data = {
  sources: Map<string, Types.DeepMutable<Source>>
  candidates: Map<string, Types.DeepMutable<Candidate>>
}

type Draft = {
  add(name: string, source: Source): void
  remove(name: string): void
  list(): readonly [string, Source][]
  candidate: {
    add(candidate: Candidate): void
    remove(id: string): void
    list(): readonly Candidate[]
  }
}

export interface Interface extends State.Transformable<Draft> {
  readonly list: () => Effect.Effect<Info[]>
  readonly catalog: () => Effect.Effect<Catalog>
  readonly check: (ids: readonly string[]) => Effect.Effect<Catalog>
  readonly select: (selection: Selection) => Effect.Effect<void>
  readonly refresh: (ids?: readonly string[]) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Reference") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const global = yield* Global.Service
    const bus = yield* Bus.Service
    const cache = yield* RepositoryCache.Service
    const kv = yield* KV.Service
    const scope = yield* Scope.Scope
    const materialized = new Map<string, Info>()
    const access = new Map<string, Reference.Access>()
    const SelectionKey = "reference.catalog.selection"
    let selection: Selection = { enabled: false, ids: [] }
    let generation = 0

    const readSelection = Effect.fn("Reference.readSelection")(function* () {
      const stored = yield* kv.get(SelectionKey)
      const decoded = Schema.decodeUnknownOption(Selection)(stored)
      if (stored !== undefined && Option.isNone(decoded)) yield* kv.remove(SelectionKey)
      return Option.getOrElse(decoded, () => ({ enabled: false, ids: [] }))
    })

    const parse = (source: GitSource) => {
      const repository = Repository.parse(source.repository)
      if (!repository || !Repository.isRemote(repository)) return
      if (source.branch) {
        try {
          Repository.validateBranch(source.branch)
        } catch {
          return
        }
      }
      return repository
    }

    const info = (name: string, source: GitSource, repository: Repository.RemoteReference) =>
      Info.make({
        name,
        path: AbsolutePath.make(Repository.cachePath(global.repos, repository, source.branch)),
        ...(source.description === undefined ? {} : { description: source.description }),
        ...(source.hidden === undefined ? {} : { hidden: source.hidden }),
        source,
      })

    const materialize = Effect.fn("Reference.materialize")(function* (
      name: string,
      source: GitSource,
      candidateID?: string,
      force?: boolean,
      expectedGeneration?: number,
    ) {
      const repository = parse(source)
      if (!repository) {
        if (candidateID) access.set(candidateID, { status: "unavailable", reason: "Invalid Git repository" })
        return
      }
      const result = yield* cache
        .ensure({ reference: repository, branch: source.branch, refresh: force ? true : "daily" })
        .pipe(Effect.result)
      if (expectedGeneration !== undefined && expectedGeneration !== generation) return
      if (result._tag === "Success") {
        materialized.set(name, info(name, source, repository))
        if (candidateID) access.set(candidateID, { status: "available", head: result.success.head })
        yield* bus.publish(Reference.Event.Updated, {})
        return
      }
      yield* Effect.logWarning("failed to refresh reference", {
        name,
        repository: source.repository,
        error: result.failure,
      })
      const stale = yield* cache.ensure({ reference: repository, branch: source.branch }).pipe(Effect.result)
      if (stale._tag === "Success") {
        materialized.set(name, info(name, source, repository))
        if (candidateID)
          access.set(candidateID, {
            status: "stale",
            head: stale.success.head,
            reason: "Refresh failed; using the cached checkout",
          })
        yield* bus.publish(Reference.Event.Updated, {})
        return
      }
      materialized.delete(name)
      if (candidateID)
        access.set(candidateID, { status: "unavailable", reason: "Repository could not be materialized" })
      yield* bus.publish(Reference.Event.Updated, {})
    })

    const state = State.create<Data, Draft>({
      name: "reference",
      initial: () => ({ sources: new Map(), candidates: new Map() }),
      draft: (draft) => ({
        add: (name, source) => draft.sources.set(name, source as Types.DeepMutable<Source>),
        remove: (name) => draft.sources.delete(name),
        list: () => Array.from(draft.sources.entries()) as [string, Source][],
        candidate: {
          add: (candidate) => draft.candidates.set(candidate.id, candidate as Types.DeepMutable<Candidate>),
          remove: (id) => draft.candidates.delete(id),
          list: () => Array.from(draft.candidates.values()) as Candidate[],
        },
      }),
      finalize: (draft) =>
        Effect.gen(function* () {
          generation++
          const expectedGeneration = generation
          selection = yield* readSelection()
          const candidates = new Set(draft.candidate.list().map((candidate) => candidate.id))
          for (const id of access.keys()) {
            if (!candidates.has(id)) access.delete(id)
          }
          materialized.clear()
          for (const [name, source] of draft.list()) {
            if (source.type === "local") {
              materialized.set(
                name,
                Info.make({
                  name,
                  path: source.path,
                  ...(source.description === undefined ? {} : { description: source.description }),
                  ...(source.hidden === undefined ? {} : { hidden: source.hidden }),
                  source,
                }),
              )
              continue
            }
            yield* materialize(name, source, undefined, false, expectedGeneration).pipe(
              Effect.catchCause((cause) =>
                Effect.logWarning("failed to materialize reference", {
                  name,
                  repository: source.repository,
                  cause,
                }),
              ),
              Effect.forkIn(scope),
            )
          }
          const selected = new Set(selection.ids)
          for (const candidate of draft.candidate.list()) {
            if (!selection.enabled || !selected.has(candidate.id)) continue
            access.set(candidate.id, { status: "checking" })
            yield* materialize(candidate.name, candidate.source, candidate.id, false, expectedGeneration).pipe(
              Effect.catchCause((cause) =>
                Effect.logWarning("failed to materialize reference candidate", {
                  id: candidate.id,
                  repository: candidate.source.repository,
                  cause,
                }),
              ),
              Effect.forkIn(scope),
            )
          }
          yield* bus.publish(Reference.Event.Updated, {})
        }),
    })

    const catalog = Effect.fn("Reference.catalog")(function* () {
      const selected = new Set(selection.ids)
      return Catalog.make({
        enabled: selection.enabled,
        items: Array.from(state.get().candidates.values(), (candidate) => ({
          candidate,
          selected: selected.has(candidate.id),
          access: access.get(candidate.id) ?? { status: "unchecked" },
        })).toSorted((a, b) => a.candidate.name.localeCompare(b.candidate.name)),
      })
    })

    return Service.of({
      transform: state.transform,
      reload: state.reload,
      list: Effect.fn("Reference.list")(function* () {
        return Array.from(materialized.values())
      }),
      catalog,
      check: Effect.fn("Reference.check")(function* (ids) {
        const candidates = state.get().candidates
        yield* Effect.forEach(
          ids,
          (id) =>
            Effect.gen(function* () {
              const candidate = candidates.get(id)
              if (!candidate) return
              access.set(id, { status: "checking" })
              const available = yield* cache.check({
                repository: candidate.source.repository,
                branch: candidate.source.branch,
              })
              access.set(
                id,
                available
                  ? { status: "available" }
                  : { status: "unavailable", reason: "Repository access is unavailable" },
              )
            }),
          { concurrency: 4, discard: true },
        )
        yield* bus.publish(Reference.Event.Updated, {})
        return yield* catalog()
      }),
      select: Effect.fn("Reference.select")(function* (next) {
        const known = state.get().candidates
        selection = Selection.make({ enabled: next.enabled, ids: next.ids.filter((id) => known.has(id)) })
        yield* kv.set(SelectionKey, selection)
        yield* state.reload()
      }),
      refresh: Effect.fn("Reference.refresh")(function* (ids) {
        const candidates = state.get().candidates
        const requested = new Set(ids ?? selection.ids)
        const selected = new Set(selection.enabled ? selection.ids : [])
        yield* Effect.forEach(
          Array.from(candidates.values()).filter(
            (candidate) => selected.has(candidate.id) && requested.has(candidate.id),
          ),
          (candidate) => materialize(candidate.name, candidate.source, candidate.id, true),
          { concurrency: 2, discard: true },
        )
      }),
    })
  }),
)

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [Global.node, Bus.node, KV.node, RepositoryCache.node],
})
