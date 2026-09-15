import type { SkillApi } from "@opencode/client/effect/api"
import { Skill } from "@opencode/schema/skill"
import type { Effect, Types } from "effect"
import type { Transform } from "./registration.js"

export interface SkillEditor {
  list(): readonly Types.DeepMutable<Skill.Info>[]
  get(id: string): Types.DeepMutable<Skill.Info> | undefined
  add(skill: Skill.Info): void
  update(id: string, update: (skill: Types.DeepMutable<Skill.Info>) => void): void
  remove(id: string): void
}

// Skill availability is served over HTTP only; plugins edit skills through the editor.
export interface SkillDomain extends Pick<SkillApi<unknown>, "list"> {
  readonly transform: Transform<SkillEditor>
  readonly reload: () => Effect.Effect<void>
}
