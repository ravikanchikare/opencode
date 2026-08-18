import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Installs the curated plugin set that ships with the app.
 *
 * Distributions can bundle plugins under `Resources/opencode-plugins/`. Each is
 * a single self-contained ESM file, and this copies them into the *global*
 * OpenCode config directory, where plugin discovery picks them up for **every**
 * project — no per-project setup, and no `opencode.json`.
 *
 * ## Why single files
 *
 * A seeded plugin arrives without a `node_modules`, so anything it imports at
 * runtime must already be inlined. Shipping bundles rather than package
 * directories is what makes that true, and it also makes install atomic: one
 * `copyFileSync` per plugin, with staleness decided by comparing bytes.
 *
 * ## Why this is safe to run on every launch
 *
 * It is idempotent. Files whose contents already match are skipped, so the
 * common case touches nothing. A changed bundle overwrites the installed copy,
 * which is how an app upgrade delivers a newer plugin.
 *
 * Failures are logged and swallowed: a plugin that cannot be installed must
 * never stop the app from starting.
 */

const SEED_DIRECTORY = "opencode-plugins"

type Logger = {
  log(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

/** Mirrors the server's global config resolution, including its env override. */
export function globalConfigDirectory(env = process.env, home = homedir()): string {
  if (env.OPENCODE_CONFIG_DIR) return env.OPENCODE_CONFIG_DIR
  const xdg = env.XDG_CONFIG_HOME
  const app = env.OPENCODE_APP_ID?.trim() || "opencode"
  return xdg ? join(xdg, app) : join(home, ".config", app)
}

/** Where bundles live inside a packaged app; undefined when absent. */
export function bundledSeedDirectory(resourcesPath: string): string | undefined {
  const directory = join(resourcesPath, SEED_DIRECTORY)
  return existsSync(directory) ? directory : undefined
}

export interface SeedResult {
  readonly installed: string[]
  readonly unchanged: string[]
}

/**
 * Copies every `.js` bundle from `source` into `<config>/plugin`.
 *
 * Exported separately from the Electron entry point so it can be tested against
 * ordinary directories.
 */
export function seedPluginsFrom(source: string, configDirectory: string, logger?: Logger): SeedResult {
  const target = join(configDirectory, "plugin")
  const installed: string[] = []
  const unchanged: string[] = []

  const bundles = readdirSync(source).filter((entry) => entry.endsWith(".js"))
  if (bundles.length === 0) return { installed, unchanged }
  mkdirSync(target, { recursive: true })

  for (const bundle of bundles) {
    const from = join(source, bundle)
    const to = join(target, bundle)
    try {
      if (existsSync(to) && readFileSync(to).equals(readFileSync(from))) {
        unchanged.push(bundle)
        continue
      }
      // Copy to a sibling then rename, so the server can never observe a
      // half-written plugin. Rename within one directory is atomic.
      const staging = `${to}.installing`
      copyFileSync(from, staging)
      renameSync(staging, to)
      installed.push(bundle)
    } catch (error) {
      rmSync(`${to}.installing`, { force: true })
      logger?.error("failed to install bundled plugin", { bundle, error: String(error) })
    }
  }

  return { installed, unchanged }
}

/**
 * Startup hook. Never throws.
 *
 * Electron's `app` and `process.resourcesPath` are injected rather than
 * imported so this module stays loadable — and testable — outside Electron.
 */
export function seedBundledPlugins(input: {
  readonly packaged: boolean
  readonly resourcesPath: string
  readonly logger: Logger
  readonly configDirectory?: string
  /**
   * Explicit bundle directory, used instead of the packaged resources path and
   * honoured even when unpackaged. This is how a development build exercises
   * the real install path against its own isolated config directory, rather
   * than the behaviour only ever running in a shipped app.
   */
  readonly source?: string
}): SeedResult {
  const empty: SeedResult = { installed: [], unchanged: [] }
  try {
    const explicit = input.source && existsSync(input.source) ? input.source : undefined
    if (!explicit && !input.packaged) return empty
    const source = explicit ?? bundledSeedDirectory(input.resourcesPath)
    if (!source) return empty
    const configDirectory = input.configDirectory ?? globalConfigDirectory()
    const result = seedPluginsFrom(source, configDirectory, input.logger)
    if (result.installed.length > 0)
      input.logger.log("installed bundled plugins", { plugins: result.installed, target: configDirectory })
    return result
  } catch (error) {
    input.logger.error("bundled plugin install failed", { error: String(error) })
    return empty
  }
}
