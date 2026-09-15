import { expect, test } from "bun:test"
import { additionalIcons, additionalIconViewBox } from "./additional-icons"

test("plugin and integration icons use the existing sidebar icon metrics and color", () => {
  for (const name of ["puzzle-piece", "plug"] as const) {
    expect(additionalIconViewBox(name)).toBe(additionalIconViewBox("cube"))
    expect(additionalIcons[name]).toContain('stroke="currentColor"')
    expect(additionalIcons[name]).not.toContain("stroke-width")
    expect(additionalIcons[name]).not.toBe(additionalIcons.cube)
  }
})
