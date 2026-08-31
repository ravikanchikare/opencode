export * as ExtensionEnablement from "./extension-enablement.js"

import { Schema } from "effect"
import { ephemeral, inventory } from "./event.js"

export const Kind = Schema.Literals(["plugin", "skill"])
export type Kind = typeof Kind.Type

const Updated = ephemeral({
  type: "extension.enablement.updated",
  schema: {
    kind: Kind,
    id: Schema.String,
  },
})

export const Event = { Updated, Definitions: inventory(Updated) }
