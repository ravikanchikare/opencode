export * as Plugin from "./plugin.js"

import { Schema } from "effect"
import { ephemeral, inventory } from "./event.js"
import { optional } from "./schema.js"

export const ID = Schema.String.pipe(Schema.brand("Plugin.ID"))
export type ID = typeof ID.Type

export const Source = Schema.Union([
  Schema.Struct({ type: Schema.Literal("builtin") }),
  Schema.Struct({
    type: Schema.Literal("package"),
    target: Schema.String,
    version: Schema.String.pipe(optional),
    outdated: Schema.Literal(true).pipe(optional),
    updating: Schema.Literal(true).pipe(optional),
  }),
  Schema.Struct({ type: Schema.Literal("local"), path: Schema.String }),
  Schema.Struct({ type: Schema.Literal("sdk") }),
]).annotate({ identifier: "Plugin.Source" })
export type Source = typeof Source.Type

export const Features = Schema.Struct({
  server: Schema.Literal(true).pipe(optional),
  tui: Schema.Literal(true).pipe(optional),
  rpc: Schema.Literal(true).pipe(optional),
}).annotate({ identifier: "Plugin.Features" })
export type Features = typeof Features.Type

export const State = Schema.Union([
  Schema.Struct({ status: Schema.Literal("active") }),
  Schema.Struct({ status: Schema.Literal("failed"), error: Schema.String, ref: Schema.String.pipe(optional) }),
]).annotate({ identifier: "Plugin.State" })
export type State = typeof State.Type

/** Authored catalog information, not a claim about the live tool registry. */
export const OptionTool = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  input: Schema.Record(Schema.String, Schema.Unknown).pipe(optional),
})

export const OptionChoice = Schema.Struct({
  value: Schema.String,
  label: Schema.String,
  description: Schema.String.pipe(optional),
  group: Schema.Struct({
    id: Schema.String,
    label: Schema.String,
    description: Schema.String.pipe(optional),
  }).pipe(optional),
  tools: Schema.Array(OptionTool).pipe(optional),
}).annotate({ identifier: "Plugin.OptionChoice" })
export type OptionChoice = typeof OptionChoice.Type

export const OptionDescriptor = Schema.Struct({
  type: Schema.Literal("multi-select"),
  key: Schema.String,
  label: Schema.String,
  description: Schema.String.pipe(optional),
  choices: Schema.Array(OptionChoice),
  default: Schema.Array(Schema.String).pipe(optional),
  secret: Schema.Boolean.pipe(optional),
}).annotate({ identifier: "Plugin.OptionDescriptor" })
export type OptionDescriptor = typeof OptionDescriptor.Type

export const OptionValues = Schema.Record(Schema.String, Schema.Unknown)
export type OptionValues = typeof OptionValues.Type

export const OptionState = Schema.Struct({
  descriptors: Schema.Array(OptionDescriptor),
  requested: OptionValues.pipe(optional),
  effective: OptionValues,
  inherited: Schema.Boolean,
  scope: Schema.Literals(["default", "location"]),
}).annotate({ identifier: "Plugin.OptionState" })
export type OptionState = typeof OptionState.Type

export interface Info extends Schema.Schema.Type<typeof Info> {}
export const Info = Schema.Struct({
  id: ID.pipe(optional),
  name: Schema.String.pipe(optional),
  description: Schema.String.pipe(optional),
  source: Source,
  features: Features,
  state: State,
  options: OptionState.pipe(optional),
}).annotate({ identifier: "Plugin.Info" })

const Updated = ephemeral({
  type: "plugin.updated",
  schema: {},
})
export const Event = { Updated, Definitions: inventory(Updated) }
