import { Show, type Component } from "solid-js"
import { Button } from "@opencode/ui/button"
import { Icon } from "@opencode/ui/icon"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { autoInvokeEnabled, availabilityKey, type Scope, type SkillRow } from "./skill-availability"
import { SkillAvailabilityControls } from "./skill-availability-controls"

export const SkillDetails: Component<{
  skill: SkillRow
  documentationUrl?: string
  scope: Scope
  pending: boolean
  onEnabledChange: (enabled: boolean | undefined) => void
  onBack: () => void
}> = (props) => {
  const language = useLanguage()
  const platform = usePlatform()
  return (
    <div class="settings-tab-body extension-destination settings-detail-page">
      <div class="skill-details">
        <Button size="small" variant="ghost" class="plugin-details-back" onClick={props.onBack}>
          <Icon name="arrow-left" size="small" />
          {language.t("settings.skills.back")}
        </Button>
        <header class="skill-details-heading">
          <div class="plugin-details-heading">
            <h2 class="settings-tab-title">{props.skill.name}</h2>
            <Show when={props.skill.description}>
              <p class="plugin-details-description">
                {props.skill.description}
                <Show when={props.documentationUrl}>
                  {" "}
                  <button
                    type="button"
                    class="plugin-details-learn-more"
                    aria-label={language.t("settings.extensions.learnMore")}
                    title={language.t("settings.extensions.learnMore")}
                    onClick={() => platform.openExternal(props.documentationUrl!)}
                  >
                    <Icon name="help" size="small" />
                  </button>
                </Show>
              </p>
            </Show>
          </div>
          <SkillAvailabilityControls
            skill={props.skill}
            scope={props.scope}
            pending={props.pending}
            onChange={props.onEnabledChange}
          />
        </header>
        <dl class="skill-details-metadata">
          <dt>{language.t("settings.skills.autoinvoke")}</dt>
          <dd>{language.t(autoInvokeEnabled(props.skill) ? "settings.skills.enabled" : "settings.skills.disabled")}</dd>
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
