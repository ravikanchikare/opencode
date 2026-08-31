import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { Option, Schema } from "effect"

const RESOURCE_DIRECTORY = "opencode-plugins"
const Manifest = Schema.Struct({
  version: Schema.Literal(1),
  plugins: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      file: Schema.String,
      version: Schema.String,
      sha256: Schema.String,
    }),
  ),
})
const decodeManifest = Schema.decodeUnknownOption(Schema.fromJsonString(Manifest))

export function managedPluginPaths(input: {
  readonly packaged: boolean
  readonly resourcesPath: string
  readonly source?: string
}) {
  if (!input.source && !input.packaged) return []
  const directory = input.source ?? join(input.resourcesPath, RESOURCE_DIRECTORY)
  if (!existsSync(directory)) {
    if (input.source) throw new Error(`Managed plugin directory does not exist: ${directory}`)
    return []
  }

  const manifestFile = join(directory, "manifest.json")
  const manifest = decodeManifest(readFileSync(manifestFile, "utf8"))
  if (Option.isNone(manifest)) throw new Error(`Invalid managed plugin manifest: ${manifestFile}`)

  const ids = new Set<string>()
  const files = new Set<string>()
  return manifest.value.plugins.map((plugin) => {
    if (!plugin.id.trim()) throw new Error(`Managed plugin manifest contains an empty ID: ${manifestFile}`)
    if (ids.has(plugin.id)) throw new Error(`Duplicate managed plugin ID: ${plugin.id}`)
    if (!/^[A-Za-z0-9._-]+\.js$/.test(plugin.file)) throw new Error(`Invalid managed plugin file name: ${plugin.file}`)
    if (files.has(plugin.file)) throw new Error(`Duplicate managed plugin file: ${plugin.file}`)
    if (!/^[a-f0-9]{64}$/.test(plugin.sha256)) throw new Error(`Invalid managed plugin SHA-256 for ${plugin.id}`)

    ids.add(plugin.id)
    files.add(plugin.file)
    const file = join(directory, plugin.file)
    const actual = createHash("sha256").update(readFileSync(file)).digest("hex")
    if (actual !== plugin.sha256) throw new Error(`Managed plugin checksum mismatch: ${plugin.id}`)
    return file
  })
}

export function configureManagedPlugins(
  input: Parameters<typeof managedPluginPaths>[0],
  env: Record<string, string | undefined> = process.env,
) {
  const plugins = managedPluginPaths(input)
  env.OPENCODE_MANAGED_PLUGINS = JSON.stringify(plugins)
  return plugins
}
