#!/usr/bin/env bun
import { $ } from "bun"

import { copyBuiltCliToResources, downloadCliToResources, resolveChannel } from "./utils"

const channel = resolveChannel()
await $`bun ./scripts/copy-icons.ts ${channel}`
await $`bun ./scripts/copy-metainfo.ts ${channel}`
if (process.platform === "darwin" && Bun.env.OPENCODE_DESKTOP_ADHOC_SIGN === "true") {
  await $`bun ./scripts/build-unsigned-updater.ts`
}

if (channel === "dev") await downloadCliToResources()
if (channel === "beta" && Bun.env.OPENCODE_CLI_DIST) await copyBuiltCliToResources(Bun.env.OPENCODE_CLI_DIST)
if (channel === "beta" && !Bun.env.OPENCODE_CLI_DIST) await downloadCliToResources("beta")
