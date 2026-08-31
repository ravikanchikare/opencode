import { describe, expect } from "bun:test"
import { Effect, Exit, Fiber, Layer, Scope } from "effect"
import { TestClock } from "effect/testing"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { Global } from "@opencode-ai/util/global"
import { Reference } from "@opencode-ai/core/reference"
import { Repository } from "@opencode-ai/core/repository"
import { RepositoryCache } from "@opencode-ai/core/repository-cache"
import { it } from "./lib/effect"

const cache = Layer.mock(RepositoryCache.Service, {
  ensure: (input) =>
    Effect.succeed({
      repository: input.reference.label,
      host: input.reference.host,
      remote: input.reference.remote,
      localPath: Repository.cachePath(Global.Path.repos, input.reference, input.branch),
      status: "cached" as const,
    }),
  check: () => Effect.succeed(true),
})
const referenceLayer = AppNodeBuilder.build(Reference.node, [RepositoryCache.node.replace(cache)])
const partialAccessLayer = AppNodeBuilder.build(Reference.node, [
  RepositoryCache.node.replace(
    Layer.mock(RepositoryCache.Service, {
      ensure: () => Effect.die("access checks must not clone"),
      check: (input) => Effect.succeed(input.repository !== "owner/private"),
    }),
  ),
])

describe("Reference", () => {
  it.effect("registers normalized sources for the owning scope", () =>
    Effect.gen(function* () {
      const references = yield* Reference.Service
      const scope = yield* Scope.make()
      const path = AbsolutePath.make("/docs")
      const source = Reference.LocalSource.make({
        type: "local",
        path,
        description: "Use for API documentation",
        hidden: true,
      })
      yield* references.transform((editor) => editor.add("docs", source)).pipe(Scope.provide(scope))

      expect(yield* references.list()).toEqual([
        Reference.Info.make({ name: "docs", path, description: "Use for API documentation", hidden: true, source }),
      ])

      yield* Scope.close(scope, Exit.void)
      expect(yield* references.list()).toEqual([])
    }).pipe(Effect.provide(referenceLayer)),
  )

  it.effect("derives Git paths without exposing cache operations", () =>
    Effect.gen(function* () {
      const references = yield* Reference.Service
      const repository = Repository.parseRemote("owner/repo")
      const source = Reference.GitSource.make({ type: "git", repository: "owner/repo", branch: "main" })
      yield* references.transform((editor) => editor.add("sdk", source))
      yield* Effect.yieldNow

      expect(yield* references.list()).toEqual([
        Reference.Info.make({
          name: "sdk",
          path: AbsolutePath.make(Repository.cachePath(Global.Path.repos, repository, "main")),
          source,
        }),
      ])
    }).pipe(Effect.scoped, Effect.provide(referenceLayer)),
  )

  it.effect("preserves configured Git descriptions", () =>
    Effect.gen(function* () {
      const references = yield* Reference.Service
      const repository = Repository.parseRemote("owner/repo")
      const source = Reference.GitSource.make({
        type: "git",
        repository: "owner/repo",
        description: "Use for SDK implementation details",
      })
      yield* references.transform((editor) => editor.add("sdk", source))
      yield* Effect.yieldNow

      expect(yield* references.list()).toEqual([
        Reference.Info.make({
          name: "sdk",
          path: AbsolutePath.make(Repository.cachePath(Global.Path.repos, repository)),
          description: "Use for SDK implementation details",
          source,
        }),
      ])
    }).pipe(Effect.scoped, Effect.provide(referenceLayer)),
  )

  it.effect("validates candidates before activating the selected repositories", () =>
    Effect.gen(function* () {
      const references = yield* Reference.Service
      const candidate = Reference.Candidate.make({
        id: "sdk",
        name: "sdk",
        description: "Use for SDK implementation details",
        source: Reference.GitSource.make({ type: "git", repository: "owner/repo" }),
      })
      yield* references.transform((editor) => editor.candidate.add(candidate))

      expect(yield* references.catalog()).toEqual({
        enabled: false,
        items: [{ candidate, selected: false, access: { status: "unchecked" } }],
      })
      expect(yield* references.list()).toEqual([])

      expect(yield* references.check(["sdk"])).toEqual({
        enabled: false,
        items: [{ candidate, selected: false, access: { status: "available" } }],
      })

      const selected = yield* references
        .select({ enabled: true, ids: ["sdk"] })
        .pipe(Effect.forkChild({ startImmediately: true }))
      yield* TestClock.adjust("500 millis")
      yield* Fiber.join(selected)
      yield* Effect.yieldNow
      expect(yield* references.list()).toHaveLength(1)
      expect(yield* references.catalog()).toMatchObject({
        enabled: true,
        items: [{ candidate, selected: true, access: { status: "available" } }],
      })
    }).pipe(Effect.scoped, Effect.provide(referenceLayer)),
  )

  it.effect("reports partial and zero access without cloning candidates", () =>
    Effect.gen(function* () {
      const references = yield* Reference.Service
      const available = Reference.Candidate.make({
        id: "available",
        name: "available",
        description: "Available repository",
        source: Reference.GitSource.make({ type: "git", repository: "owner/available" }),
      })
      const unavailable = Reference.Candidate.make({
        id: "private",
        name: "private",
        description: "Unavailable repository",
        source: Reference.GitSource.make({ type: "git", repository: "owner/private" }),
      })
      yield* references.transform((editor) => {
        editor.candidate.add(available)
        editor.candidate.add(unavailable)
      })

      expect(yield* references.check(["available", "private"])).toMatchObject({
        items: [
          { candidate: available, access: { status: "available" } },
          { candidate: unavailable, access: { status: "unavailable" } },
        ],
      })
      expect(yield* references.check(["private"])).toMatchObject({
        items: [
          { candidate: available, access: { status: "available" } },
          { candidate: unavailable, access: { status: "unavailable" } },
        ],
      })
    }).pipe(Effect.scoped, Effect.provide(partialAccessLayer)),
  )

  it.effect("drops access results when a candidate is unregistered", () =>
    Effect.gen(function* () {
      const references = yield* Reference.Service
      const candidate = Reference.Candidate.make({
        id: "sdk",
        name: "sdk",
        description: "Available repository",
        source: Reference.GitSource.make({ type: "git", repository: "owner/available" }),
      })
      const first = yield* Scope.make()
      yield* references.transform((editor) => editor.candidate.add(candidate)).pipe(Scope.provide(first))
      expect(yield* references.check(["sdk"])).toMatchObject({
        items: [{ access: { status: "available" } }],
      })

      yield* Scope.close(first, Exit.void)
      const second = yield* Scope.make()
      yield* references.transform((editor) => editor.candidate.add(candidate)).pipe(Scope.provide(second))
      expect(yield* references.catalog()).toMatchObject({
        items: [{ access: { status: "unchecked" } }],
      })
      yield* Scope.close(second, Exit.void)
    }).pipe(Effect.scoped, Effect.provide(partialAccessLayer)),
  )
})
