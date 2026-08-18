import { useParams } from "@solidjs/router"
import { onCleanup } from "solid-js"
import { Dynamic } from "solid-js/web"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { getAppComposition } from "@/composition"

export function useSettingsDialog(defaultValue?: string) {
  const dialog = useDialog()
  const params = useParams<{ id?: string }>()
  let run = 0
  let dead = false

  onCleanup(() => {
    dead = true
  })

  return () => {
    const current = ++run
    const sessionID = params.id
    const component = getAppComposition().settings
    if (component) {
      void dialog.show(() => <Dynamic component={component} sessionID={sessionID} defaultValue={defaultValue} />)
      return
    }
    void import("@/components/settings-v2").then((module) => {
      if (dead || run !== current) return
      void dialog.show(() => <module.DialogSettings sessionID={sessionID} defaultValue={defaultValue} />)
    })
  }
}

export function useSettingsCommand() {
  const command = useCommand()
  const language = useLanguage()
  const show = useSettingsDialog()

  command.register("settings", () => [
    {
      id: "settings.open",
      title: language.t("command.settings.open"),
      category: language.t("command.category.settings"),
      keybind: "mod+comma",
      onSelect: show,
    },
  ])

  return show
}
