import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { notificationIcon } from "./notification-icon"

const root = fileURLToPath(new URL("..", import.meta.url))

describe("desktop notification icon", () => {
  test.each(["local", "dev", "beta", "prod"] as const)(
    "uses the stock %s channel icon without staging resources",
    async (channel) => {
      const image = await Bun.file(
        path.join(root, "icons", channel === "local" ? "dev" : channel, "icon.png"),
      ).arrayBuffer()
      const expected = `data:image/png;base64,${Buffer.from(image).toString("base64")}`
      expect(notificationIcon(undefined, channel)).toBe(expected)
      expect(notificationIcon("   ", channel)).toBe(expected)
      expect(notificationIcon("icons", channel)).toBe(expected)
    },
  )

  test("embeds a custom directory's PNG without retaining its path", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "desktop-notification-"))
    const image = await Bun.file(path.join(root, "icons/prod/icon.png")).arrayBuffer()
    try {
      await Bun.write(path.join(directory, "icon.png"), image)
      const icon = notificationIcon(` ${directory} `, "dev")
      await rm(directory, { recursive: true })
      expect(icon).toBe(`data:image/png;base64,${Buffer.from(image).toString("base64")}`)
      expect(icon).not.toContain(directory)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("resolves relative custom directories under desktop resources", async () => {
    // The relative path intentionally points back to a tracked stock fixture.
    const image = await Bun.file(path.join(root, "icons/beta/icon.png")).arrayBuffer()
    expect(notificationIcon("../icons/beta", "prod")).toBe(
      `data:image/png;base64,${Buffer.from(image).toString("base64")}`,
    )
  })

  test("does not silently replace a missing distribution icon with stock branding", () => {
    expect(() => notificationIcon("missing-notification-test-icons", "dev")).toThrow()
  })

  test.each(["serve", "build"])("the real %s config projects the selected PNG into the renderer", async (command) => {
    const directory = path.join(root, "icons/beta")
    // Config loading runs in its own process so channel/branding inputs cannot
    // leak into other tests that load Electron's config.
    const child = Bun.spawn(
      [
        process.execPath,
        "--eval",
        `
      import { loadConfigFromFile } from "electron-vite"
      const loaded = await loadConfigFromFile({ command: ${JSON.stringify(command)}, mode: "production" })
      console.log(loaded.config.renderer.define["import.meta.env.OPENCODE_NOTIFICATION_ICON"])
    `,
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          OPENCODE_CHANNEL: "prod",
          OPENCODE_DESKTOP_ICON_DIR: directory,
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const [stdout, stderr, exit] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect(stderr).toBe("")
    expect(exit).toBe(0)
    expect(JSON.parse(stdout)).toBe(notificationIcon(directory, "prod"))
  })
})
