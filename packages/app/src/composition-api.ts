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
  type SettingsExtensionPanel,
  type SettingsTabContentProps,
  type SettingsTabEntry,
} from "./composition"

export {
  EXTENSION_PANELS,
  ExtensionDestination,
  ExtensionList,
  ExtensionRow,
  IntegrationsPanel,
  McpPanel,
  PluginsPanel,
  SkillsPanel,
  integrationAuthLabel,
  type ExtensionPanelName,
  type ExtensionPanelProps,
} from "./settings/extensions/panels"
export { useMcpServers, usePlugins, type ExtensionScope, type McpRow } from "./settings/extensions/data"

export { useIntegrations } from "./providers/catalog/integrations"
export { useMcpToggle } from "./providers/connect/mcp"
export { pluginLabels } from "./providers/catalog/plugin"
export { useLanguage } from "./runtime/i18n/language"
export { useProviders } from "./providers/catalog/providers"
export { useServer } from "./runtime/server/current"
export { useServerSDK } from "./runtime/server/client"

export { DialogConnectProvider, ProviderConnection, useProviderConnectController } from "./providers/connect/dialog"
export { SettingsList as SettingsListV2 } from "./settings/list"
export { SettingsRow as SettingsRowV2 } from "./settings/row"
export { SettingsServerScope } from "./settings/server-scope"

export { Button as ButtonV2 } from "@opencode/ui/button"
export { Icon } from "@opencode/ui/icon"
export { Icon as IconV2 } from "@opencode/ui/icon"
export { ProviderIcon } from "@opencode/ui/provider-icon"
export { Badge as Tag } from "@opencode/ui/badge"
export { Switch as SwitchV2 } from "@opencode/ui/switch"
export { useDialog } from "@opencode/ui/context/dialog"
export { Dialog as DialogRoot } from "@kobalte/core/dialog"
export { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogTitleGroup } from "@opencode/ui/dialog"

export { showToast } from "./shell/notifications/toast"
