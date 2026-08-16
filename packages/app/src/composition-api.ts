// This module is the supported product-composition boundary. Consumers should
// not import private app aliases to build replacement Home or Settings surfaces.
export {
  configureAppComposition,
  type AppComposition,
  type HomeSurfaceProps,
  type SettingsSurfaceProps,
} from "./composition"
export { useCommand } from "./context/command"
export { useGlobal, useServerCtx } from "./context/global"
export { useLanguage } from "./context/language"
export { useLayout } from "./context/layout"
export { useModels } from "./context/models"
export { usePlatform } from "./context/platform"
export { useServerSDK } from "./context/server-sdk"
export { ServerConnection, useServers } from "./context/servers"
export { useTabs } from "./context/tabs"
export { useProviders } from "./hooks/use-providers"
export { SettingsServerScope } from "./components/settings-server-picker"
export { SettingsListV2 } from "./components/settings-v2/parts/list"
export { SettingsRowV2 } from "./components/settings-v2/parts/row"
export { SettingsWorkspacesV2 } from "./components/settings-v2/workspaces"
export { Persist, persisted } from "./utils/persist"
export { showToast } from "./utils/toast"
export { useDialog } from "@opencode-ai/ui/context/dialog"

export function loadDialogEditProject() {
  return import("./components/dialog-edit-project-v2")
}
