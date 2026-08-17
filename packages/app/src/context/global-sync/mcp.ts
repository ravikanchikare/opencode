import type { McpServer } from "@opencode-ai/client/promise"
import type { ServerApi } from "@/utils/server"

export async function toggleMcp(input: {
  status: McpServer["status"]["status"]
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  authenticate: () => Promise<void>
  refresh: () => Promise<void>
}) {
  if (input.status === "pending") return
  await {
    connected: input.disconnect,
    needs_auth: input.authenticate,
    disabled: input.connect,
    failed: input.connect,
  }[input.status]()
  await input.refresh()
}

/**
 * Location a set of MCP calls applies to. Omitted entirely for the server-wide
 * (global) view, which is a distinct scope from any directory rather than a
 * default one, so the property must be absent and not `{ directory: undefined }`.
 */
type McpLocation = { readonly directory: string } | undefined

const at = (location: McpLocation) => (location ? { location } : {})

/**
 * Starts the OAuth flow for a server sitting at `needs_auth`.
 *
 * Remote MCP servers are registered by the host as OAuth integrations, so the
 * credential lives in the global store and the server reconnects on its own
 * once the flow completes — there is nothing to write back here.
 */
export async function authenticateMcp(input: {
  api: ServerApi
  name: string
  location?: McpLocation
  openExternal: (url: string) => void
}) {
  const scope = at(input.location)
  const server = (await input.api.mcp.list(scope)).data.find((item) => item.name === input.name)
  if (!server?.integrationID) throw new Error(`MCP server ${input.name} has no authentication integration`)
  const integration = await input.api.integration.get({ integrationID: server.integrationID, ...scope })
  const method = integration.data?.methods.find((item) => item.type === "oauth" && !item.form?.length)
  if (!method || method.type !== "oauth")
    throw new Error(`MCP server ${input.name} requires an interactive authentication form`)
  const attempt = await input.api.integration.oauth.connect({
    integrationID: server.integrationID,
    methodID: method.id,
    ...scope,
  })
  input.openExternal(attempt.data.url)
}

export const connectMcp = (api: ServerApi, name: string, location?: McpLocation) =>
  api.mcp.connect({ server: name, ...at(location) }).then(() => undefined)

export const disconnectMcp = (api: ServerApi, name: string, location?: McpLocation) =>
  api.mcp.disconnect({ server: name, ...at(location) }).then(() => undefined)
