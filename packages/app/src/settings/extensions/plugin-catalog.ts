import type { PluginOptionChoice } from "@opencode/client"

export function pluginChoiceValues(choices: readonly PluginOptionChoice[]) {
  return choices.flatMap((choice) => [choice.value, ...(choice.children ?? []).map((child) => child.value)])
}

export function pluginChoiceMatches(choice: PluginOptionChoice, query: string) {
  const search = query.trim().toLowerCase()
  if (!search) return true
  return `${choice.label} ${choice.description ?? ""} ${choice.group?.label ?? ""} ${choice.group?.description ?? ""}`
    .toLowerCase()
    .includes(search)
}

/** A domain match keeps its catalog; an operation match reveals only matching operations. */
export function filterPluginChoices(choices: readonly PluginOptionChoice[], query: string) {
  const search = query.trim().toLowerCase()
  return choices.flatMap((choice) => {
    if (pluginChoiceMatches(choice, search)) return [{ choice, tools: choice.tools ?? [] }]
    const tools = (choice.tools ?? []).filter((tool) =>
      `${tool.name} ${tool.description}`.toLowerCase().includes(search),
    )
    return tools.length ? [{ choice, tools }] : []
  })
}

/** A parent match reveals its entire child catalog; otherwise children match by domain or operation. */
export function filterPluginChoiceChildren(choice: PluginOptionChoice, query: string) {
  if (pluginChoiceMatches(choice, query)) return filterPluginChoices(choice.children ?? [], "")
  return filterPluginChoices(choice.children ?? [], query)
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
