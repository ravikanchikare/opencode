import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { validDeepLinks } from "./deep-links"

test("admits open-project links only for absolute directories", async () => {
  const directory = await mkdtemp(join(tmpdir(), "opencode-deep-link-"))
  const file = join(directory, "file")
  try {
    await writeFile(file, "")
    expect(await validDeepLinks([`opencode://open-project?path=${encodeURIComponent(directory)}`], "opencode")).toEqual([
      `opencode://open-project?path=${encodeURIComponent(directory)}`,
    ])
    expect(
      await validDeepLinks(["opencode://open-project?path=relative", `opencode://open-project?path=${file}`], "opencode"),
    ).toEqual([])
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})
