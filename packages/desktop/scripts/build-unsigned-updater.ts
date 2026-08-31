#!/usr/bin/env bun
import { $ } from "bun"
import { chmod, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const packageDir = dirname(fileURLToPath(import.meta.url))
const source = join(packageDir, "unsigned-updater.swift")
const dest = join(packageDir, "../resources/opencode-unsigned-updater")

if (process.platform !== "darwin") {
  console.log("skipping unsigned updater helper (not macOS)")
  process.exit(0)
}

await mkdir(join(packageDir, "../resources"), { recursive: true })
await $`swiftc -O -o ${dest} ${source}`
await chmod(dest, 0o755)
console.log(`built unsigned updater helper at ${dest}`)
