import { existsSync } from "node:fs"
import path from "node:path"
import { app } from "electron"
import { Effect } from "effect"
import { MANUAL_UPDATE_URL } from "../constants"
import { setAppQuitting } from "../windows"
import { HELPER_NAME, makeUnsignedDarwinPlatform } from "./unsigned-darwin"

export const make = Effect.sync(() => {
  const feedUrl = import.meta.env.OPENCODE_DESKTOP_UPDATE_URL?.trim()
  if (!feedUrl) throw new Error("OPENCODE_DESKTOP_UPDATE_URL is required for unsigned macOS updates")
  const publicKey = import.meta.env.OPENCODE_DESKTOP_UPDATE_PUBLIC_KEY?.trim()
  if (!publicKey) throw new Error("OPENCODE_DESKTOP_UPDATE_PUBLIC_KEY is required for unsigned macOS updates")
  const helperPath = resolveHelperPath()
  if (!existsSync(helperPath)) throw new Error(`Unsigned updater helper is missing at ${helperPath}`)
  return makeUnsignedDarwinPlatform({
    feedUrl,
    publicKey,
    currentVersion: app.getVersion(),
    cacheDir: path.join(app.getPath("userData"), "unsigned-updates"),
    helperPath,
    appPath: app.getPath("exe").replace(/\/Contents\/MacOS\/[^/]+$/, ""),
    pid: process.pid,
    quit: () => app.quit(),
    setQuitting: setAppQuitting,
    manualUpdateUrl: MANUAL_UPDATE_URL,
  })
})

function resolveHelperPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, HELPER_NAME)
  return path.join(import.meta.dirname, "../../../../resources", HELPER_NAME)
}
