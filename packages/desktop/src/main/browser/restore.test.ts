import { expect, test } from "bun:test"
import { Browser } from "@opencode/plugin-browser/rpc"
import { mkdtemp, rm } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"
import { openDatabase } from "../storage/database"
import { createStateStore } from "../storage/state"
import { createBrowserRestoreStore } from "./restore"

test("persists browser tab URLs and focus across a database reopen", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "opencode-browser-restore-"))
  const filename = path.join(directory, "state.sqlite")
  const first = openDatabase(filename)
  const storage = createStateStore(first.db)
  const restore = createBrowserRestoreStore(storage)
  const key = "local\nses_restore"
  const tab = {
    id: Browser.TabID.make("tab_00000000-0000-0000-0000-000000000001"),
    url: "https://example.com/docs",
    title: "Transient title",
    loading: false,
    canGoBack: true,
    canGoForward: false,
    generation: 5,
  }
  restore.save(key, { tabs: [tab], focusedTabID: tab.id })
  storage.close()
  first.close()

  const second = openDatabase(filename)
  const reopenedStorage = createStateStore(second.db)
  const reopened = createBrowserRestoreStore(reopenedStorage)
  try {
    expect(reopened.load(key)).toEqual({ tabs: [{ id: tab.id, url: tab.url }], focusedTabID: tab.id })
    expect(reopened.load("remote\nses_restore")).toEqual({ tabs: [], focusedTabID: null })
    reopened.save(key, { tabs: [], focusedTabID: null })
    expect(reopened.load(key)).toEqual({ tabs: [], focusedTabID: null })
    reopened.remove(key)
    expect(reopenedStorage.get("opencode.browser.dat", key)).toBeNull()
  } finally {
    reopenedStorage.close()
    second.close()
    // Bun's SQLite shim can retain WAL handles on Windows after close.
    await rm(directory, { recursive: true, force: true }).catch(() => undefined)
  }
})

test("ignores malformed browser restoration metadata", () => {
  const database = openDatabase(":memory:")
  const storage = createStateStore(database.db)
  try {
    storage.set("opencode.browser.dat", "local\nses_restore", '{"tabs":[{"id":"invalid","url":12}]}')
    expect(createBrowserRestoreStore(storage).load("local\nses_restore")).toEqual({ tabs: [], focusedTabID: null })
  } finally {
    storage.close()
    database.close()
  }
})

test("clears restore rows only for the selected browser profile and server", () => {
  const database = openDatabase(":memory:")
  const storage = createStateStore(database.db)
  const restore = createBrowserRestoreStore(storage)
  const empty = { tabs: [], focusedTabID: null }
  try {
    restore.save("one\nses_first", { ...empty, profile: { serverKey: "one", id: "work" } })
    restore.save("one\nses_second", { ...empty, profile: { serverKey: "one", id: "personal" } })
    restore.save("two\nses_first", { ...empty, profile: { serverKey: "two", id: "work" } })
    restore.save("one\nses_ephemeral", empty)

    restore.clearProfile({ serverKey: "one", id: "work" })

    expect(storage.get("opencode.browser.dat", "one\nses_first")).toBeNull()
    expect(storage.get("opencode.browser.dat", "one\nses_second")).not.toBeNull()
    expect(storage.get("opencode.browser.dat", "two\nses_first")).not.toBeNull()
    expect(storage.get("opencode.browser.dat", "one\nses_ephemeral")).not.toBeNull()
  } finally {
    storage.close()
    database.close()
  }
})
