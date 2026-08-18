import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { Configuration } from "electron-builder"

const execFileAsync = promisify(execFile)
const packageDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(packageDir, "../..")
const signScript = path.join(rootDir, "script", "sign-windows.ps1")
// The Electron 42 packaging update briefly installed Linux launchers/icons under
// "opencode-desktop". Keep that hidden desktop entry around so existing GNOME/KDE
// pins still resolve after the canonical app id changes back to ai.opencode.desktop.
const legacyDesktopEntry = path.join(packageDir, "resources", "linux", "opencode-desktop.desktop")
const legacyDesktopEntryFpm = `${legacyDesktopEntry}=/usr/share/applications/opencode-desktop.desktop`

const metainfoFpm = (appId: string) =>
  `${path.join(packageDir, "resources", `${appId}.metainfo.xml`)}=/usr/share/metainfo/${appId}.metainfo.xml`

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return
  if (process.env.GITHUB_ACTIONS !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir },
  )
}

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

const APP_IDS = {
  dev: "ai.opencode.desktop.dev",
  beta: "ai.opencode.desktop.beta",
  prod: "ai.opencode.desktop",
} as const

const PRODUCT_NAMES = {
  dev: "OpenCode Dev",
  beta: "OpenCode Beta",
  prod: "OpenCode",
} as const

// Packaged bundle identity. electron-builder runs in its own process at package
// time, so these cannot come from the renderer or main bundle defines — a
// branded build has to set the same values for both. Unset is stock.
const appId = process.env.OPENCODE_DESKTOP_APP_ID?.trim() || APP_IDS[channel]
const productName = process.env.OPENCODE_DESKTOP_NAME?.trim() || PRODUCT_NAMES[channel]
const deepLinkScheme = process.env.OPENCODE_DESKTOP_DEEP_LINK_SCHEME?.trim() || "opencode"
const iconDir = process.env.OPENCODE_DESKTOP_ICON_DIR?.trim() || "icons"
// The AppStream metainfo and the legacy GNOME/KDE desktop entry are stock
// OpenCode artifacts that ship as files under resources/; a branded id has none.
const branded = appId !== APP_IDS[channel]

/**
 * Where this build looks for its own updates.
 *
 * A branded build must never fall through to stock OpenCode's GitHub releases:
 * electron-updater would happily download them and install stock OpenCode over
 * the distribution. So a branded build publishes to the feed it was given, and
 * with no feed it publishes nowhere — no `app-update.yml` is generated and the
 * app reports updates as disabled rather than checking the wrong place.
 */
const updateUrl = process.env.OPENCODE_DESKTOP_UPDATE_URL?.trim()
const updateRepo = process.env.OPENCODE_DESKTOP_UPDATE_REPO?.trim()
if (updateUrl && updateRepo)
  throw new Error("Set OPENCODE_DESKTOP_UPDATE_URL or OPENCODE_DESKTOP_UPDATE_REPO, not both")
if (updateRepo && !/^[^/\s]+\/[^/\s]+$/.test(updateRepo))
  throw new Error(`OPENCODE_DESKTOP_UPDATE_REPO must be "owner/repo", got "${updateRepo}"`)

const publishFor = (stock: Configuration["publish"]) => {
  // The two shapes a distribution actually ships with: releases on GitHub, or a
  // static file host. Both are stated rather than inferred — a generic feed may
  // legitimately live at a github.com URL, so sniffing the URL would guess wrong.
  if (updateRepo) {
    const [owner, repo] = updateRepo.split("/")
    return { provider: "github", owner, repo, channel: "latest" } as const
  }
  if (updateUrl) return { provider: "generic", url: updateUrl } as const
  return branded ? undefined : stock
}

const getBase = (appId: string): Configuration => ({
  artifactName: "opencode-desktop-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  // Linux launchers are .desktop files, so this is the desktop file name,
  // not just the app id. For prod, app id "ai.opencode.desktop" becomes
  // "ai.opencode.desktop.desktop".
  // https://developer.gnome.org/documentation/guidelines/maintainer/integrating.html
  // https://www.electron.build/docs/linux/
  extraMetadata: {
    desktopName: `${appId}.desktop`,
  },
  files: ["out/**/*", "resources/**/*", "!resources/opencode-cli*"],
  extraResources: [
    ...(channel !== "prod"
      ? [
          {
            from: "resources/",
            to: "",
            filter: ["opencode-cli*"],
          },
        ]
      : []),
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: `resources/${iconDir}/icon.icns`,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "resources/entitlements.plist",
    entitlementsInherit: "resources/entitlements.plist",
    notarize: true,
    target: ["dmg", "zip"],
  },
  dmg: {
    sign: true,
  },
  protocols: {
    name: productName,
    schemes: [deepLinkScheme],
  },
  win: {
    icon: `resources/${iconDir}/icon.ico`,
    signtoolOptions: {
      sign: signWindows,
    },
    target: ["nsis"],
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    installerIcon: `resources/${iconDir}/icon.ico`,
    installerHeaderIcon: `resources/${iconDir}/icon.ico`,
  },
  linux: {
    icon: `resources/${iconDir}`,
    category: "Development",
    executableName: appId,
    desktop: {
      entry: {
        // Match the installed .desktop file and hicolor icon basename so
        // Linux shells can associate the running Electron window with its launcher.
        StartupWMClass: appId,
      },
    },
    target: ["AppImage", "deb", "rpm"],
  },
})

function getConfig() {
  const base = getBase(appId)
  const fpm = branded ? [] : [metainfoFpm(appId)]

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId,
        productName,
        deb: { fpm },
        rpm: { packageName: "opencode-dev", fpm },
      }
    }
    case "beta": {
      return {
        ...base,
        appId,
        productName,
        protocols: { name: productName, schemes: [deepLinkScheme] },
        publish: publishFor({ provider: "github", owner: "anomalyco", repo: "opencode-beta", channel: "latest" }),
        deb: { fpm },
        rpm: { packageName: "opencode-beta", fpm },
      }
    }
    case "prod": {
      return {
        ...base,
        appId,
        productName,
        protocols: { name: productName, schemes: [deepLinkScheme] },
        publish: publishFor({ provider: "github", owner: "anomalyco", repo: "opencode", channel: "latest" }),
        deb: { fpm: branded ? [] : [...fpm, legacyDesktopEntryFpm] },
        rpm: { packageName: "opencode", fpm: branded ? [] : [...fpm, legacyDesktopEntryFpm] },
      }
    }
  }
}

export default getConfig()
