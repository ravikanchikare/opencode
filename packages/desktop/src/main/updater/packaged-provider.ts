import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

/**
 * The file a distribution packages to select an updater provider.
 *
 * OpenCode ships electron-updater and knows how to update itself. A
 * distribution that applies updates some other way — a platform framework, a
 * managed installer, an MSI service — packages a native or JavaScript module
 * beside this manifest and names it here. Nothing in the host knows what that
 * module talks to: `config` is forwarded to the provider verbatim, so feed
 * URLs, keys, channels, and release policy stay entirely with whoever ships
 * the provider.
 *
 * Selection is explicit. There is no rule that infers an updater from the
 * application id, the platform, or the presence of a brand — a build without
 * this manifest keeps stock behavior.
 */
export const PROVIDER_MANIFEST_NAME = "updater-provider.json"

export type PackagedUpdaterProvider = {
  /** Filename of the provider module, resolved inside the packaged resources. */
  readonly module: string
  /** Provider-defined options. The host forwards these without reading them. */
  readonly config: Readonly<Record<string, string>>
}

export type PackagedProviderResult =
  /** No provider is configured (`provider` undefined), or one is. */
  | { readonly ok: true; readonly provider: PackagedUpdaterProvider | undefined }
  /**
   * A provider is configured and unusable. This is deliberately distinct from
   * "none configured": a distribution that shipped a broken manifest wants to
   * see an error, not a silently update-less application.
   */
  | { readonly ok: false; readonly message: string }

const invalid = (message: string): PackagedProviderResult => ({
  ok: false,
  message: `${PROVIDER_MANIFEST_NAME} is invalid: ${message}`,
})

export function readPackagedProvider(input: {
  readonly packaged: boolean
  readonly resourcesPath: string
  readonly exists?: (file: string) => boolean
  readonly read?: (file: string) => string
}): PackagedProviderResult {
  // A development run has no packaged resources to read.
  if (!input.packaged) return { ok: true, provider: undefined }
  const manifest = path.join(input.resourcesPath, PROVIDER_MANIFEST_NAME)
  const exists = input.exists ?? existsSync
  if (!exists(manifest)) return { ok: true, provider: undefined }

  let parsed: unknown
  try {
    parsed = JSON.parse((input.read ?? ((file: string) => readFileSync(file, "utf8")))(manifest))
  } catch (error) {
    return invalid(error instanceof Error ? error.message : String(error))
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return invalid("expected an object")
  const record = parsed as Record<string, unknown>
  const module = record["module"]
  if (typeof module !== "string" || module.trim() === "") return invalid('"module" must be a non-empty string')
  // The module is resolved inside the packaged resources, so it is a plain
  // filename. A separator or a parent segment would reach outside the bundle.
  if (module !== path.basename(module) || module === ".." || module === ".")
    return invalid(`"module" must be a file name inside the packaged resources, got ${JSON.stringify(module)}`)

  const rawConfig = record["config"] ?? {}
  if (typeof rawConfig !== "object" || rawConfig === null || Array.isArray(rawConfig))
    return invalid('"config" must be an object')
  const config: Record<string, string> = {}
  for (const [key, value] of Object.entries(rawConfig as Record<string, unknown>)) {
    if (typeof value !== "string") return invalid(`"config.${key}" must be a string`)
    config[key] = value
  }

  return { ok: true, provider: { module: module.trim(), config } }
}
