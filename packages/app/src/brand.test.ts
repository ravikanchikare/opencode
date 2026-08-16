import { describe, expect, test } from "bun:test"
import { brandText } from "./brand"

describe("brandText", () => {
  test("keeps stock copy when no product override is active", () => {
    expect(brandText("OpenCode Desktop", "OpenCode")).toBe("OpenCode Desktop")
  })

  test("applies a product name without changing the source dictionaries", () => {
    expect(brandText("OpenCode Desktop and OpenCode Zen", "Factory")).toBe("Factory Desktop and Factory Zen")
  })
})
