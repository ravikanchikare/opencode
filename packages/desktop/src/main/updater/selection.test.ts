import { describe, expect, test } from "bun:test"
import { readPackagedProvider, PROVIDER_MANIFEST_NAME } from "./packaged-provider"
import { selectUpdater, stockUpdateFeedConfigured } from "./selection"

const none = { ok: true, provider: undefined } as const
const packaged = {
  ok: true,
  provider: { module: "example-updater.node", config: { feedUrl: "https://example.test/appcast.xml" } },
} as const

describe("selectUpdater", () => {
  /**
   * The rule this replaces was `platform === "darwin" && appId`: a *branded*
   * macOS build was assumed to carry an external apply engine, and when it did
   * not, updates silently vanished. Branding is not a statement about updates.
   */
  test("a branded build with no packaged provider keeps stock behavior", () => {
    expect(
      selectUpdater({ packaged: true, channel: "prod", provider: none, stockFeed: true }),
    ).toEqual({ kind: "stock" })
  })

  test("a packaged provider is selected only because it was packaged", () => {
    expect(selectUpdater({ packaged: true, channel: "prod", provider: packaged, stockFeed: true })).toEqual({
      kind: "provider",
      provider: packaged.provider,
    })
    // Same manifest, and the platform never enters into it.
    expect(selectUpdater({ packaged: true, channel: "beta", provider: packaged, stockFeed: false })).toEqual({
      kind: "provider",
      provider: packaged.provider,
    })
  })

  /** The three no-update outcomes are three, not one. */
  test("disabled, unconfigured, and broken are distinguishable", () => {
    // 1. deliberately off
    expect(selectUpdater({ packaged: false, channel: "prod", provider: packaged, stockFeed: true })).toEqual({
      kind: "disabled",
    })
    expect(selectUpdater({ packaged: true, channel: "dev", provider: packaged, stockFeed: true })).toEqual({
      kind: "disabled",
    })
    // 2. no provider and no stock feed: nothing to update from
    expect(selectUpdater({ packaged: true, channel: "prod", provider: none, stockFeed: false })).toEqual({
      kind: "disabled",
    })
    // 3. a provider is configured and unusable
    expect(
      selectUpdater({
        packaged: true,
        channel: "prod",
        provider: { ok: false, message: "boom" },
        stockFeed: true,
      }),
    ).toEqual({ kind: "unavailable", message: "boom" })
  })

  /**
   * A configured-but-broken provider must not fall through to electron-updater
   * either. The distribution said how it updates; quietly using a different
   * mechanism would install the wrong artifact.
   */
  test("a broken provider does not fall back to stock", () => {
    const selection = selectUpdater({
      packaged: true,
      channel: "prod",
      provider: { ok: false, message: "malformed" },
      stockFeed: true,
    })
    expect(selection.kind).not.toBe("stock")
  })
})

describe("stockUpdateFeedConfigured", () => {
  test("stock OpenCode publishes to its own releases", () => {
    expect(stockUpdateFeedConfigured({ appId: undefined, updateUrl: undefined, updateRepo: undefined })).toBe(true)
    expect(stockUpdateFeedConfigured({ appId: "   ", updateUrl: undefined, updateRepo: undefined })).toBe(true)
  })

  test("another build needs to name a feed electron-builder can publish to", () => {
    expect(stockUpdateFeedConfigured({ appId: "com.example.app", updateUrl: undefined, updateRepo: undefined })).toBe(
      false,
    )
    expect(
      stockUpdateFeedConfigured({ appId: "com.example.app", updateUrl: "https://example.test/", updateRepo: undefined }),
    ).toBe(true)
    expect(
      stockUpdateFeedConfigured({ appId: "com.example.app", updateUrl: undefined, updateRepo: "owner/repo" }),
    ).toBe(true)
  })
})

describe("readPackagedProvider", () => {
  const read = (files: Record<string, string>, packaged = true) =>
    readPackagedProvider({
      packaged,
      resourcesPath: "/app/Contents/Resources",
      exists: (file) => file in files,
      read: (file) => files[file]!,
    })
  const manifest = `/app/Contents/Resources/${PROVIDER_MANIFEST_NAME}`

  test("no manifest means no provider, which is not an error", () => {
    expect(read({})).toEqual({ ok: true, provider: undefined })
    expect(read({ [manifest]: "{}" }, false)).toEqual({ ok: true, provider: undefined })
  })

  test("reads the module and forwards config verbatim", () => {
    const result = read({
      [manifest]: JSON.stringify({
        module: "example-updater.node",
        config: { feedUrl: "https://example.test/appcast.xml", channel: "beta" },
      }),
    })
    expect(result).toEqual({
      ok: true,
      provider: {
        module: "example-updater.node",
        config: { feedUrl: "https://example.test/appcast.xml", channel: "beta" },
      },
    })
  })

  test("a manifest with no config is a provider with no options", () => {
    expect(read({ [manifest]: JSON.stringify({ module: "updater.node" }) })).toEqual({
      ok: true,
      provider: { module: "updater.node", config: {} },
    })
  })

  /** Each of these is a packaging mistake, and each has to say so. */
  test("a malformed manifest is a fault, not an absent provider", () => {
    for (const body of [
      "{",
      "[]",
      '"a string"',
      JSON.stringify({}),
      JSON.stringify({ module: "  " }),
      JSON.stringify({ module: "updater.node", config: [] }),
      JSON.stringify({ module: "updater.node", config: { feedUrl: 3 } }),
    ]) {
      const result = read({ [manifest]: body })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toContain(PROVIDER_MANIFEST_NAME)
    }
  })

  test("the module stays inside the packaged resources", () => {
    for (const module of ["../evil.node", "/tmp/evil.node", "nested/updater.node"]) {
      expect(read({ [manifest]: JSON.stringify({ module }) }).ok).toBe(false)
    }
  })
})
