import path from "node:path"
import fs from "node:fs/promises"
import { expect } from "bun:test"
import { Effect } from "effect"
import { tmpdir } from "../../core/test/fixture/tmpdir"
import { it } from "../../core/test/lib/effect"
import { startServer } from "./fixture/server"

it.live("serves inherited skill defaults with Location overrides", () =>
  Effect.gen(function* () {
    const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("opencode-extension-endpoint-")))
    const server = yield* startServer(path.join(tmp.path, "global"))
    const first = path.join(tmp.path, "first")
    const second = path.join(tmp.path, "second")
    yield* Effect.promise(() => Promise.all([writeSkill(first), writeSkill(second)]))

    const inventory = yield* request(server, "/api/skill/inventory")
    expect(inventory.response.status).toBe(200)
    const candidate = inventory.data.find((item) => isRecord(item) && item["enabled"] === true)
    if (!isRecord(candidate) || typeof candidate["id"] !== "string") throw new Error("Expected a skill candidate")

    expect(
      (yield* request(server, `/api/skill/${encodeURIComponent(candidate["id"])}/enabled`, undefined, false)).response
        .status,
    ).toBe(204)
    const inherited = yield* request(server, "/api/skill/inventory", first)
    expect(inherited.data).toContainEqual(
      expect.objectContaining({ id: candidate["id"], enabled: false, inherited: true, defaultEnabled: false }),
    )

    expect(
      (yield* request(server, `/api/skill/${encodeURIComponent(candidate["id"])}/enabled`, first, true)).response
        .status,
    ).toBe(204)
    const overridden = yield* request(server, "/api/skill/inventory", first)
    expect(overridden.data).toContainEqual(
      expect.objectContaining({ id: candidate["id"], enabled: true, inherited: false, defaultEnabled: false }),
    )
    const other = yield* request(server, "/api/skill/inventory", second)
    expect(other.data).toContainEqual(
      expect.objectContaining({ id: candidate["id"], enabled: false, inherited: true, defaultEnabled: false }),
    )

    expect(
      (yield* request(server, `/api/skill/${encodeURIComponent(candidate["id"])}/enabled`, first, "inherit")).response
        .status,
    ).toBe(204)
    const restored = yield* request(server, "/api/skill/inventory", first)
    expect(restored.data).toContainEqual(
      expect.objectContaining({ id: candidate["id"], enabled: false, inherited: true, defaultEnabled: false }),
    )
    expect(
      (yield* request(server, `/api/skill/${encodeURIComponent(candidate["id"])}/enabled`, undefined, true)).response
        .status,
    ).toBe(204)
  }),
)

it.live("rejects an unknown plugin availability change", () =>
  Effect.gen(function* () {
    const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("opencode-plugin-endpoint-")))
    const server = yield* startServer(path.join(tmp.path, "global"))
    const directory = path.join(tmp.path, "project")
    yield* Effect.promise(() => fs.mkdir(directory))
    expect((yield* request(server, "/api/plugin/unknown/enabled", directory, false)).response.status).toBe(404)
  }),
)

async function writeSkill(directory: string) {
  const target = path.join(directory, ".opencode", "skills", "review")
  await fs.mkdir(target, { recursive: true })
  await fs.writeFile(
    path.join(target, "SKILL.md"),
    ["---", "name: Review", "description: Review code", "---", "# Review"].join("\n"),
  )
}

const request = Effect.fnUntraced(function* (
  server: { readonly base: string; readonly headers: Record<string, string> },
  pathname: string,
  directory?: string,
  enabled?: boolean | "inherit",
) {
  const url = new URL(pathname, server.base)
  if (directory) url.searchParams.set("location[directory]", directory)
  const response = yield* Effect.promise(() =>
    fetch(url, {
      headers: { ...server.headers, ...(enabled === undefined ? {} : { "content-type": "application/json" }) },
      method: enabled === undefined ? "GET" : "PUT",
      body: enabled === undefined ? undefined : JSON.stringify(enabled === "inherit" ? { inherit: true } : { enabled }),
    }),
  )
  if (response.status === 204) return { response, data: [] as unknown[] }
  const body: unknown = yield* Effect.promise(() => response.json())
  if (response.status >= 500) throw new Error(`Request failed (${response.status}): ${JSON.stringify(body)}`)
  if (Array.isArray(body)) return { response, data: body }
  if (!isRecord(body) || !Array.isArray(body["data"])) return { response, data: [] as unknown[] }
  return { response, data: body["data"] }
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
