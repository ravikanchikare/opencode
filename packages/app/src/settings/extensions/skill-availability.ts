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

import type { SkillInventory } from "@opencode/client/promise"

/** What a request without a `directory` edits, versus one with it. */
export type Scope = "default" | "location"

export interface SkillRow extends SkillInventory {
  readonly id: string
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

/** Resolve the selected row from the latest inventory rather than retaining a stale object. */
export function currentSkill(skills: readonly SkillRow[], id: string | undefined) {
  if (!id) return undefined
  return skills.find((skill) => skill.id === id)
}

/** The resolved state from the inventory, expressed in the current Settings scope. */
export function availabilityKey(skill: SkillRow, scope: Scope) {
  if (scope === "default") {
    return skill.enabled
      ? "settings.skills.availability.default.enabled"
      : "settings.skills.availability.default.disabled"
  }
  if (skill.inherited) {
    return skill.enabled
      ? "settings.skills.availability.inherited.enabled"
      : "settings.skills.availability.inherited.disabled"
  }
  return skill.enabled
    ? skill.defaultEnabled
      ? "settings.skills.availability.override.enabled.defaultEnabled"
      : "settings.skills.availability.override.enabled.defaultDisabled"
    : skill.defaultEnabled
      ? "settings.skills.availability.override.disabled.defaultEnabled"
      : "settings.skills.availability.override.disabled.defaultDisabled"
}
