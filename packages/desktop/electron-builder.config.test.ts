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
