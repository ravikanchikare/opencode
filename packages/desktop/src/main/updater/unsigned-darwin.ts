import { createHash, randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { chmod, copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Effect } from "effect"
import { verifyEd25519 } from "./ed25519"
import type { Platform } from "./index"
import { isNewerVersion, parseLatestYml, selectMacZip } from "./latest-yml"

export const HELPER_NAME = "opencode-unsigned-updater"
const FEED_NAME = "latest-mac.yml"
const SIGNATURE_NAME = "latest-mac.yml.sig"
const restartTimeout = 10_000

export type UnsignedDarwinOptions = {
  readonly feedUrl: string
  readonly publicKey: string
  readonly currentVersion: string
  readonly cacheDir: string
  readonly helperPath: string
  readonly appPath: string
  readonly pid: number
  readonly arch?: NodeJS.Architecture
  readonly fetch?: typeof fetch
  readonly spawnHelper?: (command: string, args: string[]) => void
  readonly quit: () => void
  readonly setQuitting: (quitting?: boolean) => void
  readonly canWrite?: (target: string) => Promise<boolean>
  readonly manualUpdateUrl?: string
}

export function makeUnsignedDarwinPlatform(options: UnsignedDarwinOptions): Platform {
  let staged: { version: string; zipPath: string; sha512: string } | undefined
  const fetchImpl = options.fetch ?? fetch

  const checkForUpdate = Effect.tryPromise({
    try: async () => {
      const feed = await loadFeed(options, fetchImpl)
      if (!isNewerVersion(feed.version, options.currentVersion)) return undefined
      selectMacZip(feed.files, options.arch ?? process.arch)
      return feed.version
    },
    catch: (error) => error,
  })

  const stageUpdate = Effect.tryPromise({
    try: async () => {
      const feed = await loadFeed(options, fetchImpl)
      const file = selectMacZip(feed.files, options.arch ?? process.arch)
      const zipPath = path.join(options.cacheDir, `${feed.version}-${path.basename(file.url.split("?")[0] ?? "update.zip")}`)
      await mkdir(options.cacheDir, { recursive: true })
      const bytes = await download(fetchImpl, resolveUrl(options.feedUrl, file.url))
      if (bytes.byteLength !== file.size) throw new Error(`Update size mismatch: expected ${file.size}, got ${bytes.byteLength}`)
      const digest = createHash("sha512").update(bytes).digest("base64")
      if (digest !== file.sha512) throw new Error("Update checksum mismatch")
      const partial = `${zipPath}.${randomUUID()}.partial`
      await writeFile(partial, bytes)
      await rename(partial, zipPath)
      staged = { version: feed.version, zipPath, sha512: file.sha512 }
    },
    catch: (error) => error,
  })

  const installAndRestart = Effect.tryPromise({
    try: async () => {
      if (!staged) throw new Error("Update is not ready to install")
      if (!(await (options.canWrite ?? canWriteDirectory)(options.appPath))) {
        throw new Error(
          options.manualUpdateUrl
            ? `This copy of the app is not writable. Download the latest version from ${options.manualUpdateUrl}`
            : "This copy of the app is not writable. Install the latest version manually.",
        )
      }
      const helper = await stageHelper(options.helperPath)
      const spawnHelper = options.spawnHelper ?? spawnDetached
      spawnHelper(helper, [String(options.pid), options.appPath, staged.zipPath, staged.sha512])
      options.setQuitting(true)
      options.quit()
    },
    catch: (error) => error,
  }).pipe(
    Effect.timeoutOrElse({
      duration: restartTimeout,
      orElse: () =>
        Effect.logError("update restart did not start").pipe(
          Effect.andThen(Effect.fail(new Error("Update restart did not start"))),
        ),
    }),
    Effect.tapError(() => Effect.sync(() => options.setQuitting(false))),
    Effect.andThen(Effect.never),
  )

  return {
    checkForUpdate,
    stageUpdate,
    installAndRestart,
    dispose: () => {},
  }
}

async function loadFeed(options: UnsignedDarwinOptions, fetchImpl: typeof fetch) {
  const body = await download(fetchImpl, resolveUrl(options.feedUrl, FEED_NAME))
  const signature = new TextDecoder().decode(await download(fetchImpl, resolveUrl(options.feedUrl, SIGNATURE_NAME))).trim()
  verifyEd25519(options.publicKey, body, signature)
  return parseLatestYml(new TextDecoder().decode(body))
}

async function download(fetchImpl: typeof fetch, url: string) {
  const response = await fetchImpl(url)
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

function resolveUrl(feedUrl: string, file: string) {
  if (file.startsWith("https://") || file.startsWith("http://")) return file
  return new URL(file, feedUrl.endsWith("/") ? feedUrl : `${feedUrl}/`).toString()
}

async function stageHelper(helperPath: string) {
  const dest = path.join(tmpdir(), `${HELPER_NAME}-${process.pid}`)
  await copyFile(helperPath, dest)
  await chmod(dest, 0o755)
  return dest
}

function spawnDetached(command: string, args: string[]) {
  const child = spawn(command, args, { detached: true, stdio: "ignore" })
  child.unref()
}

async function canWriteDirectory(target: string) {
  const probe = path.join(path.dirname(target), `.${path.basename(target)}.write-test`)
  try {
    await writeFile(probe, "")
    await rm(probe, { force: true })
    return true
  } catch {
    await rm(probe, { force: true }).catch(() => undefined)
    return false
  }
}
