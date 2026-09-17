import { expect, test } from "bun:test"
import { projectPath } from "./deep-links"

test("extracts open-project paths and ignores other deep links", () => {
  expect(projectPath("opencode://open-project?path=%2Fworkspace")).toEqual(["/workspace"])
  expect(projectPath("opencode://settings")).toEqual([])
  expect(projectPath("not a URL")).toEqual([])
})
