type ConfigEntry = { type: string; path?: string }

function split(path: string) {
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
  return {
    directory: index < 0 ? "" : path.slice(0, index),
    name: index < 0 ? path : path.slice(index + 1),
    separator: path.includes("\\") && !path.includes("/") ? "\\" : "/",
  }
}

export function globalConfigPath(entries: readonly ConfigEntry[]) {
  const global = entries.find((entry) => entry.type === "directory")
  if (!global?.path) return

  const documents = entries
    .filter((entry) => entry.type === "document" && !!entry.path)
    .map((entry) => entry.path!)
    .filter((path) => split(path).directory === global.path)
  const configured =
    documents.find((path) => split(path).name === "opencode.jsonc") ??
    documents.find((path) => split(path).name === "opencode.json")
  if (configured) return configured

  const separator = split(global.path).separator
  return `${global.path.replace(/[\\/]$/, "")}${separator}opencode.jsonc`
}
