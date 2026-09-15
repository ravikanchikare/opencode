export * as PluginOptionConfig from "./option-config.js"

import { Document, type Entry } from "@opencode/schema/config"
import { ConfigPlugin } from "@opencode/schema/config/plugin"
import { Plugin } from "@opencode/schema/plugin"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { Context, Effect, Layer } from "effect"
import { applyEdits, modify, parse, type ParseError } from "jsonc-parser"
import path from "path"
import { Config } from "../config.js"
import { Location } from "../location.js"
import { PluginOptions } from "./options.js"

export type Scope = "default" | "location"

export interface Authored {
  readonly requested: Record<string, unknown> | undefined
  readonly inherited: boolean
}

export interface Interface {
  readonly inspect: (id: string, scope: Scope) => Effect.Effect<Authored>
  readonly view: (info: Plugin.Info, scope: Scope) => Effect.Effect<Plugin.Info>
  readonly set: (
    id: string,
    key: string,
    value: readonly string[] | undefined,
    scope: Scope,
    descriptors?: readonly Plugin.OptionDescriptor[],
  ) => Effect.Effect<void, Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/PluginOptionConfig") {}

export function authored(entries: readonly Entry[], id: string, scope: Scope, globalConfig: string, directory: string) {
  const documents = entries.filter((entry): entry is Document => entry.type === "document")
  const scoped = documents.filter((entry) =>
    scope === "default" ? isGlobal(entry.path, globalConfig) : isLocation(entry.path, directory, globalConfig),
  )
  const requested = lastOverride(scoped, id)
  return { requested, inherited: requested === undefined } satisfies Authored
}

export function upsert(
  plugins: readonly ConfigPlugin.Plugin[] | undefined,
  id: string,
  key: string,
  value: readonly string[] | undefined,
): ConfigPlugin.Plugin[] {
  const current = [...(plugins ?? [])]
  const index = current.findIndex((entry) => matches(entry, id))
  if (value === undefined) {
    if (index === -1) return current
    const entry = current[index]
    if (typeof entry === "string") return current
    const options = { ...(entry.options ?? {}) }
    delete options[key]
    if (Object.keys(options).length === 0) return current.filter((_, item) => item !== index)
    current[index] = { package: entry.package, options }
    return current
  }
  if (index === -1) return [...current, { package: id, options: { [key]: [...value] } }]
  const entry = current[index]
  if (typeof entry === "string") {
    current[index] = { package: id, options: { [key]: [...value] } }
    return current
  }
  current[index] = { package: entry.package, options: { ...(entry.options ?? {}), [key]: [...value] } }
  return current
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const fs = yield* FSUtil.Service
    const global = yield* Global.Service
    const location = yield* Location.Service
    return Service.of({
      inspect: Effect.fn("PluginOptionConfig.inspect")(function* (id, scope) {
        return authored(yield* config.entries(), id, scope, global.config, location.directory)
      }),
      view: Effect.fn("PluginOptionConfig.view")(function* (info, scope) {
        if (!info.id || !info.options) return info
        const state = authored(yield* config.entries(), info.id, scope, global.config, location.directory)
        const descriptors = info.options.descriptors
        return {
          ...info,
          options: {
            descriptors,
            requested: state.requested ? PluginOptions.publicValues(state.requested, descriptors) : undefined,
            effective: info.options.effective,
            inherited: state.inherited,
            scope,
          },
        }
      }),
      set: Effect.fn("PluginOptionConfig.set")(function* (id, key, value, scope, descriptors = []) {
        const descriptor = descriptors.find((item) => item.key === key)
        if (descriptor && value) {
          const error = PluginOptions.validateSelection(descriptor, value)
          if (error) return yield* Effect.fail(new Error(error))
        }
        const file = yield* targetFile(fs, global.config, location.directory, scope)
        const text = (yield* fs.readFileStringSafe(file)) ?? "{}\n"
        const errors: ParseError[] = []
        const parsed: unknown = parse(text, errors, { allowTrailingComma: true })
        if (errors.length || typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
          return yield* Effect.fail(new Error(`Invalid configuration: ${file}`))
        const plugins = "plugins" in parsed ? parsed.plugins : undefined
        if (plugins !== undefined && !Array.isArray(plugins))
          return yield* Effect.fail(new Error(`Invalid plugins configuration: ${file}`))
        const next = upsert(plugins as ConfigPlugin.Plugin[] | undefined, id, key, value)
        const updated = applyEdits(
          text,
          modify(text, ["plugins"], next, { formattingOptions: { tabSize: 2, insertSpaces: true } }),
        )
        yield* fs.writeWithDirs(file, updated.endsWith("\n") ? updated : `${updated}\n`)
      }),
    })
  }),
)

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [Config.node, FSUtil.node, Global.node, Location.node],
})

function matches(entry: ConfigPlugin.Plugin, id: string) {
  if (typeof entry === "string") return entry === id
  return entry.package === id
}

function lastOverride(documents: readonly Document[], id: string) {
  let found: Record<string, unknown> | undefined
  for (const document of documents) {
    for (const entry of document.info.plugins ?? []) {
      if (typeof entry === "string" || entry.package !== id || !entry.options) continue
      if (Object.keys(entry.options).length === 0) continue
      found = { ...found, ...entry.options }
    }
  }
  return found
}

function isGlobal(file: string | undefined, globalConfig: string) {
  if (!file) return false
  return file === globalConfig || file.startsWith(globalConfig + path.sep)
}

function isLocation(file: string | undefined, directory: string, globalConfig: string) {
  if (!file || isGlobal(file, globalConfig)) return false
  return file === directory || file.startsWith(directory + path.sep)
}

const targetFile = Effect.fn("PluginOptionConfig.targetFile")(function* (
  fs: FSUtil.Interface,
  globalConfig: string,
  directory: string,
  scope: Scope,
) {
  const root = scope === "default" ? globalConfig : path.join(directory, ".opencode")
  const jsonc = path.join(root, "opencode.jsonc")
  if (yield* fs.existsSafe(jsonc)) return jsonc
  return path.join(root, "opencode.json")
})
