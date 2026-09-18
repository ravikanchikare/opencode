import { describe, expect, test } from "bun:test"
import { settingsVersionLines } from "./version"

describe("settingsVersionLines", () => {
  test("shows the product version and source revision together", () => {
    expect(settingsVersionLines({ productVersion: "0.1.3", version: "9eced8022867" })).toEqual([
      { text: "v0.1.3" },
      { text: "9eced8022867", title: "OpenCode source revision" },
    ])
  })

  test("keeps a v prefix when only one version exists", () => {
    expect(settingsVersionLines({ version: "1.18.15" })).toEqual([{ text: "v1.18.15" }])
    expect(settingsVersionLines({ productVersion: "0.1.3" })).toEqual([{ text: "v0.1.3" }])
  })
})
