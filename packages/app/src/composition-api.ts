// This module is the supported product-composition boundary. Consumers should
// not import private app aliases to build replacement Home or Settings surfaces.
export {
  configureAppComposition,
  type AppComposition,
  type HomeSurfaceProps,
  type HomeUtilityNavSurfaceProps,
  type SettingsProvidersSurfaceProps,
  type SettingsSurfaceProps,
  type SettingsTabContentProps,
  type SettingsTabEntry,
} from "./composition"
export { useCommand } from "./context/command"
export { useGlobal, useServerCtx } from "./context/global"
export { useLanguage } from "./context/language"
export { useLayout } from "./context/layout"
export { useModels } from "./context/models"
export { usePlatform } from "./context/platform"
export { useServer, ServerProvider } from "./context/server"
export { useServerSDK } from "./context/server-sdk"
export { ServerConnection, useServers } from "./context/servers"
export { useTabs } from "./context/tabs"
export { useProviders } from "./hooks/use-providers"
export { useIntegrations } from "./hooks/use-integrations"

export { SettingsServerScope } from "./components/settings-server-picker"
export { SettingsListV2 } from "./components/settings-v2/parts/list"
export { InlineServerSelect } from "./components/settings-v2/parts/server-select"
export { SettingsRowV2 } from "./components/settings-v2/parts/row"
export { SettingsWorkspacesV2 } from "./components/settings-v2/workspaces"
export { DialogConnectProvider, useProviderConnectController } from "./components/dialog-connect-provider"
export { HomeUtilityNav } from "./pages/home/home-projects-view"
export { Persist, persisted } from "./utils/persist"
export { showToast } from "./utils/toast"
export { useDialog } from "@opencode-ai/ui/context/dialog"
// Design-system primitives a replacement surface needs to look like the rest of
// Settings. Re-exported here because Tailwind's source globs and the `@/` alias
// both stop at this package, so a composition consumer cannot resolve them or
// its own utility classes on its own.
export { Icon } from "@opencode-ai/ui/icon"
export { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
export { ProviderIcon } from "@opencode-ai/ui/provider-icon"
export { Tag } from "@opencode-ai/ui/v2/badge-v2"
export { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
export { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
export { Switch } from "@opencode-ai/ui/v2/switch-v2"
export {
  authenticateMcp,
  connectMcp,
  disconnectMcp,
  toggleMcp,
} from "./context/global-sync/mcp"

export function loadDialogEditProject() {
  return import("./components/dialog-edit-project-v2")
}
