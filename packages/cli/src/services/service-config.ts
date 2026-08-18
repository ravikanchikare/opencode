import { Global } from "@opencode-ai/util/global"
import { OPENCODE_CHANNEL, OPENCODE_VERSION } from "../version"
import { Hash } from "@opencode-ai/util/hash"
import { Service, registrationFilename, serviceID as resolveServiceID } from "@opencode-ai/client/effect/service"
import { Effect, FileSystem, Option, Schema } from "effect"
import { randomBytes } from "crypto"
import path from "path"
import { selfCommand } from "../util/process"

// The CLI's service configuration file, plus the Service.EnsureOptions binding that
// points the client package's service operations at this CLI: which
// registration file (by channel), which version, and how to spawn opencode.

export const Info = Schema.Struct({
  hostname: Schema.optional(Schema.String),
  port: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(65_535))),
  password: Schema.optional(Schema.String),
  env: Schema.optional(Schema.Record(Schema.String, Schema.String)),
})
export type Info = typeof Info.Type

const keys = ["hostname", "port", "password", "env"] as const
type Key = (typeof keys)[number]

const decodeInfo = Schema.decodeUnknownEffect(Schema.fromJsonString(Info))
const decodeRegistration = Schema.decodeUnknownEffect(Schema.fromJsonString(Service.Info))

export const DEFAULT_SERVICE_ID = "opencode"

/**
 * Which background service this build runs and talks to.
 *
 * Deliberately separate from `OPENCODE_APP_ID`, which decides where
 * configuration lives. A branded desktop app shares stock OpenCode's config,
 * credentials, and projects, but runs its *own* server process, because a
 * server carries process-wide state that belongs to whoever started it: the
 * managed policy it read, the environment, the plugins on disk when it booted.
 * Sharing one server would hand those to whichever app happened to launch
 * first — the distribution's policy silently not applying, or worse, applying
 * to stock OpenCode.
 *
 * Distribution servers sit beside stock's in the same state directory,
 * separated by port and registration filename exactly as release channels
 * already are. The filename rule itself lives in `@opencode-ai/client`, which
 * every process that discovers a service already depends on.
 */
export const serviceID = resolveServiceID

export const filename = (channel = OPENCODE_CHANNEL, service = serviceID()) => registrationFilename(channel, service)

const stableChannel = (channel: string) =>
  channel === "latest" || channel === "dev" || channel === "beta" || channel === "next"

export function defaultPort(channel = OPENCODE_CHANNEL, service = serviceID()) {
  const stable = stableChannel(channel)
  // Stock ports are part of the discovery contract an already-installed client
  // relies on, so a distribution's own port may not shift any of them.
  if (service === DEFAULT_SERVICE_ID) {
    if (stable) return 0xc0de
    if (channel === "local") return 0xc0df
    return 10_000 + (Number.parseInt(Hash.fast(channel).slice(0, 8), 16) % 50_000)
  }
  return 10_000 + (Number.parseInt(Hash.fast(`${service}:${stable ? "stable" : channel}`).slice(0, 8), 16) % 50_000)
}

export function legacyFilename(channel = OPENCODE_CHANNEL) {
  if (channel === "latest" || channel === "local") return
  return `service-${Hash.fast(channel)}.json`
}

export function versionBelongsToChannel(
  version: string | undefined,
  channel = OPENCODE_CHANNEL,
  installedVersion = OPENCODE_VERSION,
) {
  if (version === undefined) return false
  if (version === installedVersion) return true
  const prefix = `0.0.0-${channel}-`
  if (!version.startsWith(prefix)) return false
  return /^\d+(?:\.\d+)?$/.test(version.slice(prefix.length))
}

export const migrateRegistration = Effect.fnUntraced(function* (
  legacy: string,
  file: string,
  channel = OPENCODE_CHANNEL,
  installedVersion = OPENCODE_VERSION,
) {
  const fs = yield* FileSystem.FileSystem
  const text = yield* fs.readFileString(legacy).pipe(Effect.option)
  if (Option.isNone(text)) return
  const registration = yield* decodeRegistration(text.value).pipe(Effect.option)
  if (Option.isNone(registration)) return
  if (!versionBelongsToChannel(registration.value.version, channel, installedVersion)) return
  yield* fs.writeFileString(file, text.value, { flag: "wx", mode: 0o600 }).pipe(Effect.ignore)
})

export const migrateConfig = Effect.fnUntraced(function* (legacy: string, file: string) {
  const fs = yield* FileSystem.FileSystem
  const text = yield* fs.readFileString(legacy).pipe(Effect.option)
  if (Option.isNone(text)) return
  if (Option.isNone(yield* decodeInfo(text.value).pipe(Effect.option))) return
  yield* fs.writeFileString(file, text.value, { flag: "wx", mode: 0o600 }).pipe(Effect.ignore)
})

function configKey(key: string): Key {
  if (key === "hostname" || key === "port" || key === "password" || key === "env") return key
  throw new Error(`Unknown service config key: ${key}`)
}

const paths = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const global = yield* Global.Service
  const name = filename()
  const legacy = legacyFilename()
  const file = path.join(global.state, name)
  return {
    fs,
    file,
    legacyConfigFile: legacy ? path.join(global.config, legacy) : undefined,
    legacyRegistrationFiles: [
      ...(legacy ? [path.join(global.state, legacy)] : []),
      // Only stock adopts the old shared registration. A distribution taking it
      // over would point itself at stock OpenCode's running server, which is the
      // collision separate service identities exist to prevent.
      ...(name !== "service.json" && OPENCODE_CHANNEL !== "local" && serviceID() === DEFAULT_SERVICE_ID
        ? [path.join(global.state, "service.json")]
        : []),
    ],
    configFile: path.join(global.config, name),
  }
})

export const options = Effect.fnUntraced(function* (input: { readonly checkVersion?: boolean } = {}) {
  const { file, legacyRegistrationFiles } = yield* paths
  yield* Effect.forEach(legacyRegistrationFiles, (legacy) => migrateRegistration(legacy, file))
  return {
    file,
    version: input.checkVersion ? OPENCODE_VERSION : undefined,
    env: (yield* read()).env,
    command: [
      ...selfCommand(),
      "serve",
      "--service",
      ...(process.env.OPENCODE_CPU_PROFILE ? ["--cpu-profile", process.env.OPENCODE_CPU_PROFILE] : []),
    ],
  }
})

export const read = Effect.fn("cli.service-config.read")(function* () {
  const { fs, configFile, legacyConfigFile } = yield* paths
  if (legacyConfigFile) yield* migrateConfig(legacyConfigFile, configFile)
  return yield* fs.readFileString(configFile).pipe(
    Effect.flatMap(decodeInfo),
    Effect.catch(() => Effect.succeed({} as Info)),
  )
})

const write = Effect.fn("cli.service-config.write")(function* (value: Info) {
  const { fs, configFile } = yield* paths
  const temp = configFile + ".tmp"
  yield* fs.makeDirectory(path.dirname(configFile), { recursive: true })
  yield* fs.writeFileString(temp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 })
  yield* fs.rename(temp, configFile)
})

export const password = Effect.fn("cli.service-config.password")(function* (value?: string) {
  const existing = yield* read()
  if (value === undefined && existing.password) return existing.password
  const next = value ?? randomBytes(32).toString("base64url")

  // Keep one private credential across server restarts so discovered clients
  // can reconnect without exposing a password flag or environment variable.
  yield* write({ ...existing, password: next })
  return next
})

export const get = Effect.fn("cli.service-config.get")(function* (key?: string, name?: string) {
  if (key === undefined) {
    const { password: _password, ...safe } = yield* read()
    return JSON.stringify(safe, null, 2)
  }
  const selected = configKey(key)
  if (selected !== "env" && name !== undefined) throw new Error(`Usage: opencode service get ${selected}`)
  switch (selected) {
    case "hostname": {
      return (yield* read()).hostname ?? ""
    }
    case "port": {
      const port = (yield* read()).port
      return port === undefined ? "" : String(port)
    }
    case "password": {
      return yield* password()
    }
    case "env": {
      const env = (yield* read()).env ?? {}
      return name === undefined ? JSON.stringify(env, null, 2) : (env[name] ?? "")
    }
  }
  throw new Error(`Unknown service config key: ${key}`)
})

export const set = Effect.fn("cli.service-config.set")(function* (key: string, value: string, nestedValue?: string) {
  const selected = configKey(key)
  if (selected !== "env" && nestedValue !== undefined)
    throw new Error(`Usage: opencode service set ${selected} <value>`)
  switch (selected) {
    case "hostname": {
      yield* Service.stop(yield* options())
      yield* write({ ...(yield* read()), hostname: value })
      return
    }
    case "port": {
      const port = Number(value)
      if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("Port must be between 1 and 65535")
      yield* Service.stop(yield* options())
      yield* write({ ...(yield* read()), port })
      return
    }
    case "password": {
      yield* Service.stop(yield* options())
      yield* password(value)
      return
    }
    case "env": {
      if (nestedValue === undefined) throw new Error("Usage: opencode service set env <key> <value>")
      yield* Service.stop(yield* options())
      const existing = yield* read()
      yield* write({ ...existing, env: { ...existing.env, [value]: nestedValue } })
      return
    }
  }
})

export const unset = Effect.fn("cli.service-config.unset")(function* (key: string, name?: string) {
  const selected = configKey(key)
  if (selected !== "env" && name !== undefined) throw new Error(`Usage: opencode service unset ${selected}`)
  switch (selected) {
    case "hostname": {
      yield* Service.stop(yield* options())
      const { hostname: _hostname, ...next } = yield* read()
      yield* write(next)
      return
    }
    case "port": {
      yield* Service.stop(yield* options())
      const { port: _port, ...next } = yield* read()
      yield* write(next)
      return
    }
    case "password": {
      yield* Service.stop(yield* options())
      const { password: _password, ...next } = yield* read()
      yield* write(next)
      return
    }
    case "env": {
      if (name === undefined) throw new Error("Usage: opencode service unset env <key>")
      yield* Service.stop(yield* options())
      const existing = yield* read()
      const { [name]: _removed, ...env } = existing.env ?? {}
      const { env: _existingEnv, ...rest } = existing
      yield* write(Object.keys(env).length === 0 ? rest : { ...rest, env })
      return
    }
  }
})

export * as ServiceConfig from "./service-config"
