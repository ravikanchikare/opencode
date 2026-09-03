import { describe, expect, test } from "bun:test"
import { globalConfigPath } from "./config-path"

describe("globalConfigPath", () => {
  test("prefers the loaded global jsonc document", () => {
    expect(
      globalConfigPath([
        { type: "document", path: "/home/user/.config/opencode/opencode.jsonc" },
        { type: "directory", path: "/home/user/.config/opencode" },
        { type: "document", path: "/project/opencode.jsonc" },
        { type: "directory", path: "/project" },
      ]),
    ).toBe("/home/user/.config/opencode/opencode.jsonc")
  })

  test("reports the path where a missing global config can be created", () => {
    expect(globalConfigPath([{ type: "directory", path: "/home/user/.config/opencode" }])).toBe(
      "/home/user/.config/opencode/opencode.jsonc",
    )
  })

  test("preserves Windows separators", () => {
    expect(globalConfigPath([{ type: "directory", path: "C:\\Users\\me\\.config\\opencode" }])).toBe(
      "C:\\Users\\me\\.config\\opencode\\opencode.jsonc",
    )
  })
})
