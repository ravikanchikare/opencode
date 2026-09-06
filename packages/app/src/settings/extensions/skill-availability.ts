/**
 * The decisions a Skills destination makes about scope, extracted so they can
 * be tested without a DOM.
 *
 * None of this is availability logic — the host owns that. `enabled`,
 * `inherited` and `defaultEnabled` arrive already resolved from
 * `skill.inventory`, and everything here is about which *scope* a control
 * writes to and how that scope is presented.
 *
 * Scope is carried by the presence of the location query, not by a parameter:
 * the server reads `default` when a request has no location and `location`
 * when it does. So the Settings tab's own `directory` prop is the scope, and
 * a global Settings window necessarily edits the global default.
 */

/** What a request without a `directory` edits, versus one with it. */
export type Scope = "default" | "location"

export interface SkillRow {
  readonly id: string
  readonly name: string
  readonly enabled: boolean
  readonly inherited: boolean
  readonly defaultEnabled: boolean
}

export function scopeOf(directory: string | undefined): Scope {
  return directory === undefined ? "default" : "location"
}

/**
 * Only a project override can be cleared. In global scope there is nothing to
 * inherit from, and `inherited` is always reported false there — so without
 * the scope check the reset control would appear on every global row.
 */
export function canReset(row: SkillRow, scope: Scope): boolean {
  return scope === "location" && !row.inherited
}

/**
 * The sub-label under a skill name. Global scope states the default it is
 * setting; project scope only speaks up when this project departs from that
 * default, so an ordinary inherited row stays quiet.
 */
export function detailOf(row: SkillRow, scope: Scope): string | undefined {
  if (scope === "default") return row.enabled ? undefined : "Off by default in every project"
  if (row.inherited) return undefined
  return row.defaultEnabled ? "Overrides the default: on elsewhere" : "Overrides the default: off elsewhere"
}

/**
 * The payload for `skill.setEnabled`. `undefined` means "use default", which is
 * only ever a project operation: `inherit` clears the override and lets the
 * global default apply again. Clearing is refused in global scope because there
 * is no outer scope to fall back to.
 */
export function payloadFor(
  enabled: boolean | undefined,
  scope: Scope,
): { readonly enabled: boolean } | { readonly inherit: true } {
  if (enabled !== undefined) return { enabled }
  if (scope === "default") throw new Error("the global default cannot inherit")
  return { inherit: true }
}

/** Rows as Settings shows them: by name, then id so the order is total. */
export function ordered<T extends { readonly id: string; readonly name: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}
