export * as Reference from "./reference.js"

import { Schema } from "effect"
import { optional } from "./schema.js"
import { ephemeral, inventory } from "./event.js"
import { AbsolutePath } from "./schema.js"

const Updated = ephemeral({ type: "reference.updated", schema: {} })
export const Event = { Updated, Definitions: inventory(Updated) }

export interface LocalSource extends Schema.Schema.Type<typeof LocalSource> {}
export const LocalSource = Schema.Struct({
  type: Schema.Literal("local"),
  path: AbsolutePath,
  description: Schema.String.pipe(optional),
  hidden: Schema.Boolean.pipe(optional),
}).annotate({ identifier: "Reference.LocalSource" })

export interface GitSource extends Schema.Schema.Type<typeof GitSource> {}
export const GitSource = Schema.Struct({
  type: Schema.Literal("git"),
  repository: Schema.String,
  branch: Schema.String.pipe(optional),
  description: Schema.String.pipe(optional),
  hidden: Schema.Boolean.pipe(optional),
}).annotate({ identifier: "Reference.GitSource" })

export const Source = Schema.Union([LocalSource, GitSource])
  .pipe(Schema.toTaggedUnion("type"))
  .annotate({ identifier: "Reference.Source" })
export type Source = typeof Source.Type

export const Candidate = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  source: GitSource,
  description: Schema.String,
  recommended: Schema.Boolean.pipe(optional),
}).annotate({ identifier: "Reference.Candidate" })
export interface Candidate extends Schema.Schema.Type<typeof Candidate> {}

export const Access = Schema.Union([
  Schema.Struct({ status: Schema.Literal("unchecked") }),
  Schema.Struct({ status: Schema.Literal("checking") }),
  Schema.Struct({ status: Schema.Literal("available"), head: Schema.String.pipe(optional) }),
  Schema.Struct({
    status: Schema.Literal("stale"),
    head: Schema.String.pipe(optional),
    reason: Schema.String,
  }),
  Schema.Struct({ status: Schema.Literal("unavailable"), reason: Schema.String }),
])
  .pipe(Schema.toTaggedUnion("status"))
  .annotate({ identifier: "Reference.Access" })
export type Access = typeof Access.Type

export const CatalogItem = Schema.Struct({
  candidate: Candidate,
  selected: Schema.Boolean,
  access: Access,
}).annotate({ identifier: "Reference.CatalogItem" })
export interface CatalogItem extends Schema.Schema.Type<typeof CatalogItem> {}

export const Catalog = Schema.Struct({
  enabled: Schema.Boolean,
  items: Schema.Array(CatalogItem),
}).annotate({ identifier: "Reference.Catalog" })
export interface Catalog extends Schema.Schema.Type<typeof Catalog> {}

export const Selection = Schema.Struct({
  enabled: Schema.Boolean,
  ids: Schema.Array(Schema.String),
}).annotate({ identifier: "Reference.Selection" })
export interface Selection extends Schema.Schema.Type<typeof Selection> {}

export const Info = Schema.Struct({
  name: Schema.String,
  path: AbsolutePath,
  description: Schema.String.pipe(optional),
  hidden: Schema.Boolean.pipe(optional),
  source: Source,
}).annotate({ identifier: "Reference.Info" })
export interface Info extends Schema.Schema.Type<typeof Info> {}
