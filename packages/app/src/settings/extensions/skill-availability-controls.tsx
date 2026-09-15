import { Show, type Component } from "solid-js"
import { Switch } from "@opencode/ui/switch"
import { useLanguage } from "@/runtime/i18n/language"
import { canReset, type Scope, type SkillRow } from "./skill-availability"

/** The same scoped availability control in the inventory and its detail page. */
export const SkillAvailabilityControls: Component<{
  skill: SkillRow
  scope: Scope
  pending: boolean
  onChange: (enabled: boolean | undefined) => void
}> = (props) => {
  const language = useLanguage()
  return (
    <div class="extension-destination-controls">
      <Show when={canReset(props.skill, props.scope)}>
        <button
          type="button"
          class="extension-destination-reset"
          disabled={props.pending}
          onClick={() => props.onChange(undefined)}
        >
          {language.t("settings.skills.reset")}
        </button>
      </Show>
      <Switch
        checked={props.skill.enabled}
        disabled={props.pending}
        hideLabel
        onChange={(enabled) => {
          if (props.pending || enabled === props.skill.enabled) return
          props.onChange(enabled)
        }}
      >
        {props.skill.name}
      </Switch>
    </div>
  )
}
