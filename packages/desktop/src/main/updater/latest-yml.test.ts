import { describe, expect, test } from "bun:test"
import { isNewerVersion, parseLatestYml, selectMacZip } from "./latest-yml"

describe("latest-yml", () => {
  test("selects the matching architecture zip and ignores dmg payloads", () => {
    const parsed = parseLatestYml(`version: 1.2.3
files:
  - url: workbench-1.2.3-mac-arm64.zip
    sha512: arm
    size: 10
  - url: workbench-1.2.3-mac-x64.zip
    sha512: intel
    size: 11
  - url: workbench-1.2.3-mac-arm64.dmg
    sha512: dmg
    size: 12
path: workbench-1.2.3-mac-arm64.zip
sha512: arm
releaseDate: '2026-04-08T00:00:00.000Z'
`)
    expect(selectMacZip(parsed.files, "arm64").url).toBe("workbench-1.2.3-mac-arm64.zip")
    expect(selectMacZip(parsed.files, "x64").url).toBe("workbench-1.2.3-mac-x64.zip")
  })

  test("treats a later prerelease as older than the matching release", () => {
    expect(isNewerVersion("1.0.0", "1.0.0-beta.1")).toBe(true)
    expect(isNewerVersion("1.0.0-beta.2", "1.0.0-beta.1")).toBe(true)
    expect(isNewerVersion("1.0.0-beta.1", "1.0.0")).toBe(false)
  })
})
