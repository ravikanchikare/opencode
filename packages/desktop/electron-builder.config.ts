import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { CustomMacSignOptions } from "app-builder-lib"
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

export function macSignOptions(options: CustomMacSignOptions): CustomMacSignOptions {
  return {
    ...options,
    optionsForFile: (file) => {
      const defaults = options.optionsForFile?.(file)
      if (file !== path.join(options.app, "Contents/Resources/opencode-cli")) return defaults ?? {}
      // The Bun CLI loads bun-pty's native library; Electron and its helpers do not need this exception.
      return { ...defaults, entitlements: path.join(packageDir, "resources/entitlements.cli.plist") }
    },
  }
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

const appId = process.env.OPENCODE_DESKTOP_APP_ID?.trim() || APP_IDS[channel]
const productName = process.env.OPENCODE_DESKTOP_NAME?.trim() || PRODUCT_NAMES[channel]
const deepLinkScheme = process.env.OPENCODE_DESKTOP_DEEP_LINK_SCHEME?.trim() || "opencode"
const version = process.env.OPENCODE_DESKTOP_VERSION?.trim()
if (version && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(version))
  throw new Error(`OPENCODE_DESKTOP_VERSION must be a semantic version, got "${version}"`)
const adHocSigning = process.env.OPENCODE_DESKTOP_ADHOC_SIGN === "true"
const iconDir = process.env.OPENCODE_DESKTOP_ICON_DIR?.trim() || "icons"
const packagedExternalIconDir = "opencode-distribution-icons"
const externalIconResources = path.isAbsolute(iconDir) ? [{ from: iconDir, to: packagedExternalIconDir }] : []
const icon = (name: string) =>
  path.isAbsolute(iconDir) ? path.join(iconDir, name) : `resources/${iconDir}/${name}`
const branded = appId !== APP_IDS[channel]

const updateUrl = process.env.OPENCODE_DESKTOP_UPDATE_URL?.trim()
const updateRepo = process.env.OPENCODE_DESKTOP_UPDATE_REPO?.trim()
if (updateUrl && updateRepo)
  throw new Error("Set OPENCODE_DESKTOP_UPDATE_URL or OPENCODE_DESKTOP_UPDATE_REPO, not both")
if (updateRepo && !/^[^/\s]+\/[^/\s]+$/.test(updateRepo))
  throw new Error(`OPENCODE_DESKTOP_UPDATE_REPO must be "owner/repo", got "${updateRepo}"`)

const publishFor = (stock: Configuration["publish"], appId: string) => {
  if (updateRepo) {
    const [owner, repo] = updateRepo.split("/")
    return { provider: "github", owner, repo, channel: "latest", updaterCacheDirName: `${appId}-updater` } as const
  }
  if (updateUrl) return { provider: "generic", url: updateUrl, updaterCacheDirName: `${appId}-updater` } as const
  return branded ? undefined : stock
}

const getBase = (appId: string): Configuration => ({
  artifactName: process.env.OPENCODE_DESKTOP_ARTIFACT_NAME?.trim() || "opencode-desktop-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  extraMetadata: {
    ...(branded ? { name: appId } : {}),
    desktopName: `${appId}.desktop`,
    ...(version ? { version } : {}),
  },
  files: [
    "out/**/*",
    "resources/**/*",
    "!resources/opencode-cli*",
    // Log export imports Zip.js as ESM. Keep index.js and lib, including its inline worker.
    "!**/node_modules/@zip.js/zip.js/dist{,/**/*}",
    "!**/node_modules/@zip.js/zip.js/{index.cjs,index.min.js,index-fflate.js,deno.json,eslint.config.mjs}",
    // These packages execute compiled JavaScript, not their sources or source maps.
    "!**/node_modules/{electron-updater,builder-util-runtime,lazy-val}/out/**/*.js.map",
    "!**/node_modules/ajv/lib{,/**/*}",
    "!**/node_modules/ajv-formats/src{,/**/*}",
    "!**/node_modules/{ajv,ajv-formats}/dist/**/*.js.map",
    // Keep js-yaml's CommonJS sources and dist/js-yaml.mjs ESM entry, not browser bundles or its CLI.
    "!**/node_modules/js-yaml/dist/{js-yaml.js,js-yaml.min.js,*.map}",
    "!**/node_modules/js-yaml/bin{,/**/*}",
  ],
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
    ...externalIconResources,
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: icon("icon.icns"),
    identity: adHocSigning ? "-" : undefined,
    hardenedRuntime: !adHocSigning,
    gatekeeperAssess: false,
    entitlements: "resources/entitlements.plist",
    entitlementsInherit: "resources/entitlements.plist",
    sign: async (options) => {
      const { sign } = await import("app-builder-lib/out/codeSign/macCodeSign.js")
      await sign(macSignOptions(options))
    },
    notarize: !adHocSigning,
    target: ["dmg", "zip"],
  },
  dmg: {
    sign: !adHocSigning,
  },
  protocols: {
    name: productName,
    schemes: [deepLinkScheme],
  },
  win: {
    icon: icon("icon.ico"),
    signtoolOptions: {
      sign: signWindows,
    },
    target: ["nsis"],
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    installerIcon: icon("icon.ico"),
    installerHeaderIcon: icon("icon.ico"),
  },
  linux: {
    icon: path.isAbsolute(iconDir) ? iconDir : `resources/${iconDir}`,
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
        publish: publishFor({ provider: "github", owner: "anomalyco", repo: "opencode-beta", channel: "latest" }, appId),
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
        publish: publishFor({ provider: "github", owner: "anomalyco", repo: "opencode", channel: "latest" }, appId),
        deb: { fpm: branded ? [] : [...fpm, legacyDesktopEntryFpm] },
        rpm: { packageName: "opencode", fpm: branded ? [] : [...fpm, legacyDesktopEntryFpm] },
      }
    }
  }
}

export default getConfig()
