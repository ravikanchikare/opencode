import type { SettingsTabEntry } from "@/composition"

/**
 * Every stock Settings tab value, in render order.
 *
 * Used only to decide whether a composed tab's `before` anchor names something
 * real. The triggers themselves stay written out in `shell.tsx`, where their
 * grouping is visible on the page.
 */
export const STOCK_TAB_VALUES = [
  "general",
  "appearance",
  "notifications",
  "shortcuts",
  "servers",
  "projects",
  "workspaces",
  "providers",
  "models",
  "extensions",
  "mcp",
  "plugins",
  "skills",
] as const

export type StockSettingsTab = (typeof STOCK_TAB_VALUES)[number]

export const STOCK_TAB_GROUPS: readonly (readonly string[])[] = [
  ["general", "appearance", "notifications", "shortcuts"],
  ["servers", "projects", "workspaces"],
  ["providers", "models", "extensions", "mcp", "plugins", "skills"],
]

export function groupSettingsTabs(
  added: readonly SettingsTabEntry[],
  hidden: ReadonlySet<string>,
  groups?: readonly (readonly string[])[],
) {
  const stockValues = new Set<string>(STOCK_TAB_VALUES)
  const visible = new Set([
    ...STOCK_TAB_VALUES.filter((value) => !hidden.has(value)),
    ...added.map((entry) => entry.value),
  ])
  const declared = new Set<string>()

  if (groups) {
    const configured = groups
      .map((group) =>
        group.filter((value) => {
          if (!visible.has(value) || declared.has(value)) return false
          declared.add(value)
          return true
        }),
      )
      .filter((group) => group.length > 0)
    const fallback = [...visible].filter((value) => !declared.has(value))
    return fallback.length > 0 ? [...configured, fallback] : configured
  }

  const result = STOCK_TAB_GROUPS.map((group) => group.filter((value) => visible.has(value)))
  const appended: string[] = []
  for (const entry of added) {
    if (entry.before && stockValues.has(entry.before)) {
      const target = result.find((group) => group.includes(entry.before!))
      if (target) {
        target.splice(target.indexOf(entry.before), 0, entry.value)
        continue
      }
    }
    appended.push(entry.value)
  }
  return appended.length > 0 ? [...result, appended] : result
}
