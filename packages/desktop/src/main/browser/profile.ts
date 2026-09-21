import { createHash } from "node:crypto"

const validID = /^[a-z0-9-]{1,64}$/

export function resolveBrowserProfile(serverKey: string, id: string) {
  if (!validID.test(id)) return
  const server = createHash("sha256").update(serverKey).digest("hex")
  return {
    id,
    serverKey,
    partition: `persist:opencode-browser-${server}-${id}`,
  }
}
