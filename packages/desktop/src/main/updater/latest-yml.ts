export type FileEntry = {
  url: string
  sha512: string
  size: number
  blockMapSize?: number
}

export type LatestYml = {
  version: string
  files: FileEntry[]
  path?: string
  sha512?: string
  releaseDate?: string
}

export function parseLatestYml(content: string): LatestYml {
  const lines = content.split("\n")
  let version = ""
  let releaseDate = ""
  let path = ""
  let sha512 = ""
  const files: FileEntry[] = []
  let current: Partial<FileEntry> | undefined

  const flush = () => {
    if (current?.url && current.sha512 && current.size) files.push(current as FileEntry)
    current = undefined
  }

  for (const line of lines) {
    const indented = line.startsWith("    ") || line.startsWith("  -")
    if (line.startsWith("version:")) version = unquote(line.slice("version:".length).trim())
    else if (line.startsWith("releaseDate:")) releaseDate = unquote(line.slice("releaseDate:".length).trim())
    else if (line.startsWith("path:")) path = unquote(line.slice("path:".length).trim())
    else if (line.startsWith("sha512:") && !current) sha512 = line.slice("sha512:".length).trim()
    else if (line.trim().startsWith("- url:")) {
      flush()
      current = { url: line.trim().slice("- url:".length).trim() }
    } else if (indented && current && line.trim().startsWith("sha512:"))
      current.sha512 = line.trim().slice("sha512:".length).trim()
    else if (indented && current && line.trim().startsWith("size:"))
      current.size = Number(line.trim().slice("size:".length).trim())
    else if (indented && current && line.trim().startsWith("blockMapSize:"))
      current.blockMapSize = Number(line.trim().slice("blockMapSize:".length).trim())
    else if (!indented && current) flush()
  }
  flush()

  if (!version) throw new Error("latest-mac.yml is missing version")
  if (files.length === 0) throw new Error("latest-mac.yml has no files")
  return {
    version,
    files,
    ...(path ? { path } : {}),
    ...(sha512 ? { sha512 } : {}),
    ...(releaseDate ? { releaseDate } : {}),
  }
}

export function selectMacZip(files: FileEntry[], arch: NodeJS.Architecture = process.arch) {
  const wanted = arch === "arm64" ? "arm64" : "x64"
  const zips = files.filter((file) => file.url.split("?")[0]?.toLowerCase().endsWith(".zip"))
  const match =
    zips.find((file) => file.url.toLowerCase().includes(`-${wanted}.zip`) || file.url.toLowerCase().includes(`-${wanted}-`)) ??
    zips.find((file) => (wanted === "arm64" ? /arm64|aarch64/i.test(file.url) : /x64|x86_64|amd64/i.test(file.url))) ??
    (zips.length === 1 ? zips[0] : undefined)
  if (!match) throw new Error(`latest-mac.yml has no zip for ${arch}`)
  return match
}

export function isNewerVersion(latest: string, current: string) {
  return compareSemver(latest, current) > 0
}

function unquote(value: string) {
  return value.replace(/^['"]|['"]$/g, "")
}

function compareSemver(left: string, right: string) {
  const a = parseSemver(left)
  const b = parseSemver(right)
  for (let i = 0; i < 3; i++) {
    if (a.core[i] > b.core[i]) return 1
    if (a.core[i] < b.core[i]) return -1
  }
  if (a.pre.length === 0 && b.pre.length === 0) return 0
  if (a.pre.length === 0) return 1
  if (b.pre.length === 0) return -1
  const n = Math.max(a.pre.length, b.pre.length)
  for (let i = 0; i < n; i++) {
    const x = a.pre[i]
    const y = b.pre[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    const xn = Number(x)
    const yn = Number(y)
    if (Number.isInteger(xn) && Number.isInteger(yn)) {
      if (xn > yn) return 1
      if (xn < yn) return -1
      continue
    }
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

function parseSemver(value: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(value.trim())
  if (!match) throw new Error(`Invalid version: ${value}`)
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])] as const,
    pre: match[4] ? match[4].split(".") : [],
  }
}
