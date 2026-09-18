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

test("the input schema braces use the standard icon canvas", () => {
  expect(additionalIconViewBox("braces")).toBe("0 0 20 20")
  expect(additionalIcons.braces).toContain('stroke="currentColor"')
  expect(additionalIcons.braces).toContain("M7.5 2.5")
})
