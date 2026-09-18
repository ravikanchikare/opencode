/**
 * Which integrations belong on an Integrations destination.
 *
 * The host has no "this is a service" flag, and the answer cannot be reached by
 * subtraction. `provider.list()` returns *available* providers, so every model
 * provider the user has not connected is already absent from it — filtering on
 * that absence leaves essentially the whole models.dev catalog. Measured
 * against a running server: 217 integrations, 1 available provider, 215
 * survivors. That list is not a destination, it is a phone book.
 *
 * So selection is positive, from two things the host actually knows:
 *
 * - a **web-search provider** is a service by construction — it is credentialed
 *   and consumed as a tool, never as a model;
 * - a **connected** integration that is not an available model provider is one
 *   the user has deliberately set up for something other than models.
 *
 * MCP-owned integrations are excluded either way. A remote MCP server's OAuth
 * integration (`mcp_<sha1>`) is created by, and disconnected through, the MCP
 * surface; listing it here too gives two controls for one connection that
 * disagree the moment one refetches.
 *
 * Both signals are host state. Nothing here consults a curated list, and a
 * distribution that wants a different set should say so by presenting its own
 * destination, not by teaching the host its product vocabulary.
 */

export type IntegrationConnection = { readonly type: string; readonly name?: string }
export type IntegrationMethod = { readonly type: string; readonly names?: readonly string[] }

export type IntegrationLike = {
  readonly id: string
  readonly name: string
  readonly methods?: readonly IntegrationMethod[]
  readonly connections?: readonly IntegrationConnection[]
}

export type IntegrationRow = {
  readonly id: string
  readonly name: string
  readonly auth: string
  readonly connected: boolean
  readonly viaCredential: boolean
  readonly envName?: string
  readonly connectable: boolean
}

/** How a connection is made, in the words the connect dialog uses. */
export function integrationAuthLabel(methods: readonly IntegrationMethod[]): string {
  const types = new Set(methods.map((method) => method.type))
  if (types.has("oauth")) return "OAuth"
  if (types.has("key")) return "API Key"
  if (types.has("env")) {
    const names = methods.find((method) => method.type === "env")?.names ?? []
    return names.length > 0 ? `Env: ${names.join(", ")}` : "Env"
  }
  if (types.has("command")) return "Command"
  return "Unknown"
}

export function serviceIntegrations(input: {
  readonly integrations: readonly IntegrationLike[]
  readonly websearchIDs: readonly string[]
  readonly mcpOwnedIDs: readonly string[]
  readonly availableProviderIDs: readonly string[]
}): IntegrationRow[] {
  const websearch = new Set(input.websearchIDs)
  const mcpOwned = new Set(input.mcpOwnedIDs)
  const providers = new Set(input.availableProviderIDs)

  return input.integrations
    .filter((integration) => !mcpOwned.has(integration.id))
    .flatMap((integration) => {
      const connections = integration.connections ?? []
      const credential = connections.find((connection) => connection.type === "credential")
      const env = connections.find((connection) => connection.type === "env")
      const connected = credential !== undefined || env !== undefined
      if (!websearch.has(integration.id) && !(connected && !providers.has(integration.id))) return []
      const methods = integration.methods ?? []
      return [
        {
          id: integration.id,
          name: integration.name,
          auth: integrationAuthLabel(methods),
          connected,
          viaCredential: credential !== undefined,
          ...(env?.name === undefined ? {} : { envName: env.name }),
          connectable: methods.some((method) => method.type === "oauth" || method.type === "key"),
        },
      ]
    })
    .toSorted((a, b) => a.name.localeCompare(b.name))
}

/** The sub-label under a service's name. */
export function integrationSubtitle(row: IntegrationRow): string {
  if (row.viaCredential) return `Connected · ${row.auth}`
  if (row.envName) return `Connected via ${row.envName}`
  if (row.connected) return "Connected via environment"
  return row.auth
}
