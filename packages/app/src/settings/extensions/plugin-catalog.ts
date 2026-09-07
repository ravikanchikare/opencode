import type { PluginOptionChoice } from "@opencode-ai/client"

/** A domain match keeps its catalog; an operation match reveals only matching operations. */
export function filterPluginChoices(choices: readonly PluginOptionChoice[], query: string) {
  const search = query.trim().toLowerCase()
  return choices.flatMap((choice) => {
    if (!search || `${choice.label} ${choice.description ?? ""}`.toLowerCase().includes(search))
      return [{ choice, tools: choice.tools ?? [] }]
    const tools = (choice.tools ?? []).filter((tool) =>
      `${tool.name} ${tool.description}`.toLowerCase().includes(search),
    )
    return tools.length ? [{ choice, tools }] : []
  })
}
