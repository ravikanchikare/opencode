// The supported product-composition boundary. A distribution builds its
// replacement surfaces from this module alone; it must not reach into private
// app aliases, and nothing else in this package is part of the contract.
//
// Everything below is re-exported rather than imported directly by the consumer
// because both Tailwind's source globs and the `@/` alias stop at this package:
// a composed surface outside it cannot resolve `@opencode-ai/ui`, and any
// Tailwind utility class it writes is never emitted.

// The seam itself.
export {
  configureAppComposition,
  type AppComposition,
  type HomeSurfaceProps,
  type HomeUtilityNavSurfaceProps,
  type SettingsPanelProps,
  type SettingsProvidersSurfaceProps,
  type SettingsSurfaceProps,
  type SettingsTabContentProps,
  type SettingsTabEntry,
} from "./composition"

// Application context and data hooks.
export { useCommand } from "./context/command"
export { useGlobal, useServerCtx } from "./context/global"
export { useIntegrations } from "./hooks/use-integrations"
export { useLanguage } from "./context/language"
export { useLayout } from "./context/layout"
export { useModels } from "./context/models"
export { usePlatform } from "./context/platform"
export { useProviders } from "./hooks/use-providers"
export { useServer, ServerProvider } from "./context/server"
export { useServerSDK } from "./context/server-sdk"
export { ServerConnection, useServers } from "./context/servers"
export { useTabs } from "./context/tabs"

// Stock surfaces and settings building blocks a replacement can reuse.
export { DialogConnectProvider, useProviderConnectController } from "./components/dialog-connect-provider"
export { HomeUtilityNav } from "./pages/home/home-projects-view"
export { InlineServerSelect } from "./components/settings-v2/parts/server-select"
export { SettingsListV2 } from "./components/settings-v2/parts/list"
export { SettingsRowV2 } from "./components/settings-v2/parts/row"
export { SettingsServerScope } from "./components/settings-server-picker"
export { SettingsWorkspacesV2 } from "./components/settings-v2/workspaces"

// Design-system primitives, so a composed surface matches the rest of the app.
//
// The `V2` suffixes are kept on the *exported* names even though upstream's
// #43200 promoted these modules out of `v2/` and dropped the suffix internally.
// This module is the contract a composed surface imports through
// `virtual:opencode/app-composition`; renaming an export here breaks every
// downstream composition for no gain, and the aliasing is one line each.
export { Button as ButtonV2 } from "@opencode-ai/ui/button"
export { Icon } from "@opencode-ai/ui/icon"
export { Icon as IconV2 } from "@opencode-ai/ui/icon"
export { ProviderIcon } from "@opencode-ai/ui/provider-icon"
export { Switch } from "@opencode-ai/ui/switch"
// `Badge` is the former `Tag`: same component, renamed by #43200. It still
// renders `data-component="tag"`, so existing styling holds.
export { Badge as Tag } from "@opencode-ai/ui/badge"
export { TextInput as TextInputV2 } from "@opencode-ai/ui/text-input"
export { useDialog } from "@opencode-ai/ui/context/dialog"

// Actions a composed surface needs to drive host state.
export { useMcpToggle } from "./context/mcp"
export { Persist, persisted } from "./utils/persist"
export { showToast } from "./utils/toast"

export function loadDialogEditProject() {
  return import("./components/dialog-edit-project-v2")
}
