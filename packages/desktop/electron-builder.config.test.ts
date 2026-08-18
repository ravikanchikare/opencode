import { expect, test } from "bun:test"
import type { Configuration } from "electron-builder"

const legacyDesktopEntry = "resources/linux/opencode-desktop.desktop"

const channels = [
  { channel: "dev", appId: "ai.opencode.desktop.dev" },
  { channel: "beta", appId: "ai.opencode.desktop.beta" },
  { channel: "prod", appId: "ai.opencode.desktop" },
] as const

for (const channel of channels) {
  test(`uses one Linux desktop identity for ${channel.channel}`, async () => {
    const previous = process.env.OPENCODE_CHANNEL
    process.env.OPENCODE_CHANNEL = channel.channel

    const module = await import(`./electron-builder.config.ts?channel=${channel.channel}`)
    const config = module.default as Configuration

    if (previous === undefined) delete process.env.OPENCODE_CHANNEL
    else process.env.OPENCODE_CHANNEL = previous

    expect(config.appId).toBe(channel.appId)
    expect(config.extraMetadata?.desktopName).toBe(`${channel.appId}.desktop`)
    expect(config.linux?.executableName).toBe(channel.appId)
    expect(config.linux?.desktop?.entry?.StartupWMClass).toBe(channel.appId)
    expect(config.deb?.fpm).toContainEqual(expect.stringContaining(`/usr/share/metainfo/${channel.appId}.metainfo.xml`))
    expect(config.rpm?.fpm).toContainEqual(expect.stringContaining(`/usr/share/metainfo/${channel.appId}.metainfo.xml`))
  })
}

test("keeps a hidden prod launcher for old Linux pins", async () => {
  const previous = process.env.OPENCODE_CHANNEL
  process.env.OPENCODE_CHANNEL = "prod"

  const module = await import("./electron-builder.config.ts?compat=prod")
  const config = module.default as Configuration

  if (previous === undefined) delete process.env.OPENCODE_CHANNEL
  else process.env.OPENCODE_CHANNEL = previous

  expect(
    config.deb?.fpm?.some((entry) =>
      entry.endsWith("opencode-desktop.desktop=/usr/share/applications/opencode-desktop.desktop"),
    ),
  ).toBe(true)
  expect(
    config.rpm?.fpm?.some((entry) =>
      entry.endsWith("opencode-desktop.desktop=/usr/share/applications/opencode-desktop.desktop"),
    ),
  ).toBe(true)

  const desktop = await Bun.file(legacyDesktopEntry).text()
  expect(desktop).toContain("Exec=/opt/OpenCode/ai.opencode.desktop %U")
  expect(desktop).toContain("Icon=ai.opencode.desktop")
  expect(desktop).toContain("StartupWMClass=ai.opencode.desktop")
  expect(desktop).toContain("NoDisplay=true")
})

for (const channel of ["dev", "beta"] as const) {
  test(`bundles the CLI outside the ${channel} app archive`, async () => {
    const previous = process.env.OPENCODE_CHANNEL
    process.env.OPENCODE_CHANNEL = channel
    const module = await import(`./electron-builder.config.ts?cli-resource=${channel}`)
    const config = module.default as Configuration
    if (previous === undefined) delete process.env.OPENCODE_CHANNEL
    else process.env.OPENCODE_CHANNEL = previous

    expect(config.files).toContain("!resources/opencode-cli*")
    expect(config.extraResources).toContainEqual({
      from: "resources/",
      to: "",
      filter: ["opencode-cli*"],
    })
  })
}

test("does not bundle the CLI in prod builds", async () => {
  const previous = process.env.OPENCODE_CHANNEL
  process.env.OPENCODE_CHANNEL = "prod"
  const module = await import("./electron-builder.config.ts?no-cli-resource=prod")
  const config = module.default as Configuration
  if (previous === undefined) delete process.env.OPENCODE_CHANNEL
  else process.env.OPENCODE_CHANNEL = previous

  expect(config.extraResources).not.toContainEqual({
    from: "resources/",
    to: "",
    filter: ["opencode-cli*"],
  })
})

test("packages a branded distribution under its own identity", async () => {
  const previous = {
    channel: process.env.OPENCODE_CHANNEL,
    appId: process.env.OPENCODE_DESKTOP_APP_ID,
    name: process.env.OPENCODE_DESKTOP_NAME,
    scheme: process.env.OPENCODE_DESKTOP_DEEP_LINK_SCHEME,
  }
  process.env.OPENCODE_CHANNEL = "prod"
  process.env.OPENCODE_DESKTOP_APP_ID = "ai.factory.desktop"
  process.env.OPENCODE_DESKTOP_NAME = "Factory"
  process.env.OPENCODE_DESKTOP_DEEP_LINK_SCHEME = "factory"

  const module = await import("./electron-builder.config.ts?brand=factory")
  const config = module.default as Configuration

  for (const [key, value] of [
    ["OPENCODE_CHANNEL", previous.channel],
    ["OPENCODE_DESKTOP_APP_ID", previous.appId],
    ["OPENCODE_DESKTOP_NAME", previous.name],
    ["OPENCODE_DESKTOP_DEEP_LINK_SCHEME", previous.scheme],
  ] as const) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  expect(config.appId).toBe("ai.factory.desktop")
  expect(config.productName).toBe("Factory")
  expect(config.protocols).toEqual({ name: "Factory", schemes: ["factory"] })
  expect(config.extraMetadata?.desktopName).toBe("ai.factory.desktop.desktop")
  expect(config.linux?.executableName).toBe("ai.factory.desktop")
  // The AppStream metainfo and the legacy launcher are stock OpenCode files
  // that exist under resources/; a branded build ships neither.
  expect(config.deb?.fpm).toEqual([])
  expect(config.rpm?.fpm).toEqual([])
})

test("never points a branded build at stock OpenCode's releases", async () => {
  const previous = { channel: process.env.OPENCODE_CHANNEL, appId: process.env.OPENCODE_DESKTOP_APP_ID }
  process.env.OPENCODE_CHANNEL = "prod"
  process.env.OPENCODE_DESKTOP_APP_ID = "ai.factory.desktop"

  const module = await import("./electron-builder.config.ts?brand-updates=none")
  const config = module.default as Configuration

  if (previous.channel === undefined) delete process.env.OPENCODE_CHANNEL
  else process.env.OPENCODE_CHANNEL = previous.channel
  if (previous.appId === undefined) delete process.env.OPENCODE_DESKTOP_APP_ID
  else process.env.OPENCODE_DESKTOP_APP_ID = previous.appId

  // Inheriting the stock feed would install stock OpenCode over the branded app.
  expect(config.publish).toBeUndefined()
})

test("publishes a branded build to the feed it was given", async () => {
  const previous = {
    channel: process.env.OPENCODE_CHANNEL,
    appId: process.env.OPENCODE_DESKTOP_APP_ID,
    url: process.env.OPENCODE_DESKTOP_UPDATE_URL,
  }
  process.env.OPENCODE_CHANNEL = "prod"
  process.env.OPENCODE_DESKTOP_APP_ID = "ai.factory.desktop"
  process.env.OPENCODE_DESKTOP_UPDATE_URL = "https://updates.example.com/factory"

  const module = await import("./electron-builder.config.ts?brand-updates=feed")
  const config = module.default as Configuration

  for (const [key, value] of [
    ["OPENCODE_CHANNEL", previous.channel],
    ["OPENCODE_DESKTOP_APP_ID", previous.appId],
    ["OPENCODE_DESKTOP_UPDATE_URL", previous.url],
  ] as const) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  expect(config.publish).toEqual({ provider: "generic", url: "https://updates.example.com/factory" })
})

test("publishes a branded build to its own GitHub releases", async () => {
  const previous = {
    channel: process.env.OPENCODE_CHANNEL,
    appId: process.env.OPENCODE_DESKTOP_APP_ID,
    repo: process.env.OPENCODE_DESKTOP_UPDATE_REPO,
  }
  process.env.OPENCODE_CHANNEL = "prod"
  process.env.OPENCODE_DESKTOP_APP_ID = "ai.factory.desktop"
  process.env.OPENCODE_DESKTOP_UPDATE_REPO = "acme/factory"

  const module = await import("./electron-builder.config.ts?brand-updates=repo")
  const config = module.default as Configuration

  for (const [key, value] of [
    ["OPENCODE_CHANNEL", previous.channel],
    ["OPENCODE_DESKTOP_APP_ID", previous.appId],
    ["OPENCODE_DESKTOP_UPDATE_REPO", previous.repo],
  ] as const) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  expect(config.publish).toEqual({ provider: "github", owner: "acme", repo: "factory", channel: "latest" })
})

test("rejects an update repo that is not owner/repo", async () => {
  const previous = process.env.OPENCODE_DESKTOP_UPDATE_REPO
  process.env.OPENCODE_DESKTOP_UPDATE_REPO = "https://github.com/acme/factory"

  const attempt = import("./electron-builder.config.ts?brand-updates=bad-repo")
  await expect(attempt).rejects.toThrow(/owner\/repo/)

  if (previous === undefined) delete process.env.OPENCODE_DESKTOP_UPDATE_REPO
  else process.env.OPENCODE_DESKTOP_UPDATE_REPO = previous
})

test("rejects setting both update seams at once", async () => {
  const previous = {
    url: process.env.OPENCODE_DESKTOP_UPDATE_URL,
    repo: process.env.OPENCODE_DESKTOP_UPDATE_REPO,
  }
  process.env.OPENCODE_DESKTOP_UPDATE_URL = "https://updates.example.com/factory"
  process.env.OPENCODE_DESKTOP_UPDATE_REPO = "acme/factory"

  const attempt = import("./electron-builder.config.ts?brand-updates=both")
  await expect(attempt).rejects.toThrow(/not both/)

  for (const [key, value] of [
    ["OPENCODE_DESKTOP_UPDATE_URL", previous.url],
    ["OPENCODE_DESKTOP_UPDATE_REPO", previous.repo],
  ] as const) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})
