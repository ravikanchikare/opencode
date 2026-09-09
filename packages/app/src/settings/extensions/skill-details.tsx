import { Show, type Component } from "solid-js"
import { Button } from "@opencode/ui/button"
import { Icon } from "@opencode/ui/icon"
import { useLanguage } from "@/runtime/i18n/language"
import { availabilityKey, type Scope, type SkillRow } from "./skill-availability"

export const SkillDetails: Component<{
  skill: SkillRow
  scope: Scope
  onBack: () => void
}> = (props) => {
  const language = useLanguage()
  return (
    <div class="settings-tab-body extension-destination">
      <div class="skill-details">
        <Button size="small" variant="ghost" class="plugin-details-back" onClick={props.onBack}>
          <Icon name="arrow-left" size="small" />
          {language.t("settings.skills.back")}
        </Button>
        <header class="plugin-details-heading">
          <h2 class="settings-tab-title">{props.skill.name}</h2>
          <Show when={props.skill.description}>
            <p class="plugin-details-description">{props.skill.description}</p>
          </Show>
        </header>
        <dl class="skill-details-metadata">
          <dt>{language.t("settings.skills.id")}</dt>
          <dd>
            <code>{props.skill.id}</code>
          </dd>
          <dt>{language.t("settings.skills.source")}</dt>
          <dd>
            <code>{props.skill.location}</code>
          </dd>
          <dt>{language.t("settings.skills.slash")}</dt>
          <dd>{language.t(props.skill.slash ? "settings.skills.enabled" : "settings.skills.disabled")}</dd>
          <dt>{language.t("settings.skills.autoinvoke")}</dt>
          <dd>{language.t(props.skill.autoinvoke ? "settings.skills.enabled" : "settings.skills.disabled")}</dd>
          <dt>{language.t("settings.skills.availability")}</dt>
          <dd>{language.t(availabilityKey(props.skill, props.scope))}</dd>
        </dl>
        <section class="skill-details-content" aria-label={language.t("settings.skills.instructions")}>
          <h3 class="settings-section-title">{language.t("settings.skills.instructions")}</h3>
          <pre>{props.skill.content}</pre>
        </section>
      </div>
    </div>
  )
}
