import type { PluginOptionChoice } from "@opencode/client"

/** A domain match keeps its catalog; an operation match reveals only matching operations. */
export function filterPluginChoices(choices: readonly PluginOptionChoice[], query: string) {
  const search = query.trim().toLowerCase()
  return choices.flatMap((choice) => {
    if (
      !search ||
      `${choice.label} ${choice.description ?? ""} ${choice.group?.label ?? ""} ${choice.group?.description ?? ""}`
        .toLowerCase()
        .includes(search)
    )
      return [{ choice, tools: choice.tools ?? [] }]
    const tools = (choice.tools ?? []).filter((tool) =>
      `${tool.name} ${tool.description}`.toLowerCase().includes(search),
    )
    return tools.length ? [{ choice, tools }] : []
  })
}

/** Authored order controls both rows and columns; missing cells remain unavailable. */
export function groupPluginChoices(choices: readonly PluginOptionChoice[], query: string) {
  const matched = new Map(filterPluginChoices(choices, query).map((row) => [row.choice.value, row.tools]))
  const groups = new Map<string, { id: string; label: string; description?: string; choices: PluginOptionChoice[] }>()
  for (const choice of choices) {
    if (!choice.group) continue
    const group = groups.get(choice.group.id) ?? { ...choice.group, choices: [] }
    group.choices.push(choice)
    groups.set(group.id, group)
  }
  return {
    columns: [...new Set(choices.filter((choice) => choice.group).map((choice) => choice.label))],
    rows: [...groups.values()].filter((group) => group.choices.some((choice) => matched.has(choice.value))),
    matched,
  }
}
