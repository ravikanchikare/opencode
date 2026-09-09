import { describe, expect, test } from "bun:test"
import { configureAppComposition } from "@/composition"
import type { PluginInfo } from "@opencode/client"
import { pluginInventoryRows } from "./data"

const plugin = (id: string | undefined, source: PluginInfo["source"]["type"] = "local"): PluginInfo => ({
  id,
  source: source === "builtin" ? { type: "builtin" } : { type: "local", path: "/plugin" },
  features: { server: true },
  state: { status: "active" },
})

describe("Settings plugin inventory", () => {
  test("preserves ordinary plugins and excludes builtins with an empty composition", () => {
    configureAppComposition({})
    expect(
      pluginInventoryRows([plugin("third-party.plugin"), plugin(undefined), plugin("builtin", "builtin")]).map(
        (item) => item.id,
      ),
    ).toEqual(["third-party.plugin", undefined])
  })

  test("omits listed IDs while retaining third-party and unidentified diagnostic rows", () => {
    configureAppComposition({ pluginPresentation: { hiddenPluginIDs: ["factory.packaged"] } })
    expect(
      pluginInventoryRows([plugin("factory.packaged"), plugin("third-party.plugin"), plugin(undefined)]).map(
        (item) => item.id,
      ),
    ).toEqual(["third-party.plugin", undefined])
    configureAppComposition({})
  })
})
