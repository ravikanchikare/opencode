export {
  configureAppComposition,
  showNewSessionProviderTip,
  type AppComposition,
  type AppNewSessionComposition,
  type AppSettingsDefaults,
  type HomeUtilityNavSurfaceProps,
  type OnboardingSurfaceProps,
  type ProviderConnectionBannerSurfaceProps,
  type SettingsPanelProps,
  type SettingsProvidersSurfaceProps,
  type SettingsTabContentProps,
  type SettingsTabEntry,
} from "./composition"

export { useIntegrations } from "./providers/catalog/integrations"
export { useMcpToggle } from "./providers/connect/mcp"
export { pluginLabels } from "./providers/catalog/plugin"
export { useLanguage } from "./runtime/i18n/language"
export { useProviders } from "./providers/catalog/providers"
export { useServer } from "./runtime/server/current"
export { useServerSDK } from "./runtime/server/client"

export { DialogConnectProvider, ProviderConnection, useProviderConnectController } from "./providers/connect/dialog"
export { InlineServerSelect } from "./settings/server-select"
export { SettingsList as SettingsListV2 } from "./settings/list"
export { SettingsRow as SettingsRowV2 } from "./settings/row"
export { SettingsServerScope } from "./settings/server-scope"

export { Button as ButtonV2 } from "@opencode-ai/ui/button"
export { Icon } from "@opencode-ai/ui/icon"
export { Icon as IconV2 } from "@opencode-ai/ui/icon"
export { ProviderIcon } from "@opencode-ai/ui/provider-icon"
export { Badge as Tag } from "@opencode-ai/ui/badge"
export { Switch as SwitchV2 } from "@opencode-ai/ui/switch"
export { useDialog } from "@opencode-ai/ui/context/dialog"
export { Dialog as DialogRoot } from "@kobalte/core/dialog"
export { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogTitleGroup } from "@opencode-ai/ui/dialog"

export { showToast } from "./shell/notifications/toast"
