import { describe, expect, test } from "bun:test"

import {
  integrationAuthLabel,
  integrationSubtitle,
  serviceIntegrations,
  type IntegrationLike,
} from "./integration-selection"

const integration = (id: string, overrides: Partial<IntegrationLike> = {}): IntegrationLike => ({
  id,
  name: id,
  methods: [{ type: "key" }],
  connections: [],
  ...overrides,
})

const select = (input: {
  integrations: readonly IntegrationLike[]
  websearchIDs?: readonly string[]
  mcpOwnedIDs?: readonly string[]
  availableProviderIDs?: readonly string[]
}) =>
  serviceIntegrations({
    integrations: input.integrations,
    websearchIDs: input.websearchIDs ?? [],
    mcpOwnedIDs: input.mcpOwnedIDs ?? [],
    availableProviderIDs: input.availableProviderIDs ?? [],
  }).map((row) => row.id)

describe("serviceIntegrations", () => {
  /**
   * The defining case. A stock catalog is ~217 integrations, almost all of them
   * model providers nobody has connected. Selection has to be positive: an
   * unconnected, non-web-search integration is not a service, it is a row in
   * models.dev.
   */
  test("does not list an unconnected integration merely because it is not an available provider", () => {
    const catalog = ["302ai", "abacus", "aihubmix"].map((id) => integration(id))
    expect(select({ integrations: catalog, availableProviderIDs: [] })).toEqual([])
  })

  test("lists web-search providers, connected or not", () => {
    const catalog = [integration("exa"), integration("tavily"), integration("openai")]
    expect(select({ integrations: catalog, websearchIDs: ["exa", "tavily"] })).toEqual(["exa", "tavily"])
  })

  test("lists a connected integration that is not an available model provider", () => {
    const catalog = [
      integration("github", { connections: [{ type: "credential" }] }),
      integration("anthropic", { connections: [{ type: "credential" }] }),
    ]
    expect(select({ integrations: catalog, availableProviderIDs: ["anthropic"] })).toEqual(["github"])
  })

  /**
   * A remote MCP server's OAuth integration is created and disconnected through
   * the MCP surface. Two controls for one connection disagree as soon as one
   * refetches, so the exclusion wins even over a positive signal.
   */
  test("excludes MCP-owned integrations even when they would otherwise qualify", () => {
    const catalog = [integration("mcp_abc123", { connections: [{ type: "credential" }] }), integration("exa")]
    expect(select({ integrations: catalog, websearchIDs: ["exa", "mcp_abc123"], mcpOwnedIDs: ["mcp_abc123"] })).toEqual([
      "exa",
    ])
  })

  test("orders by name", () => {
    const catalog = [integration("z", { name: "Zulu" }), integration("a", { name: "Alpha" })]
    expect(select({ integrations: catalog, websearchIDs: ["z", "a"] })).toEqual(["a", "z"])
  })

  test("reports how each connection was made", () => {
    const rows = serviceIntegrations({
      integrations: [
        integration("byKey", { connections: [{ type: "credential" }], methods: [{ type: "oauth" }] }),
        // Env-only: connected, but nothing here can offer a Connect button.
        integration("byEnv", {
          connections: [{ type: "env", name: "EXA_API_KEY" }],
          methods: [{ type: "env", names: ["EXA_API_KEY"] }],
        }),
        integration("unconnected", {}),
      ],
      websearchIDs: ["byKey", "byEnv", "unconnected"],
      mcpOwnedIDs: [],
      availableProviderIDs: [],
    })
    expect(rows.map((row) => integrationSubtitle(row))).toEqual([
      "Connected via EXA_API_KEY",
      "Connected · OAuth",
      "API Key",
    ])
    expect(rows.map((row) => row.connectable)).toEqual([false, true, true])
  })
})

describe("integrationAuthLabel", () => {
  test("names the strongest method a connection offers", () => {
    expect(integrationAuthLabel([{ type: "oauth" }, { type: "key" }])).toBe("OAuth")
    expect(integrationAuthLabel([{ type: "key" }])).toBe("API Key")
    expect(integrationAuthLabel([{ type: "env", names: ["A", "B"] }])).toBe("Env: A, B")
    expect(integrationAuthLabel([{ type: "env" }])).toBe("Env")
    expect(integrationAuthLabel([{ type: "command" }])).toBe("Command")
    expect(integrationAuthLabel([])).toBe("Unknown")
  })
})
