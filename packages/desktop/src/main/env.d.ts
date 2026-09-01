declare module "virtual:vite-opencode-picker/client"

interface ImportMetaEnv {
  readonly OPENCODE_CHANNEL: string
  readonly OPENCODE_VERSION?: string
  readonly OPENCODE_DESKTOP_NAME?: string
  readonly OPENCODE_DESKTOP_APP_ID?: string
  readonly OPENCODE_DESKTOP_DEEP_LINK_SCHEME?: string
  readonly OPENCODE_DESKTOP_ICON_DIR?: string
  readonly OPENCODE_DESKTOP_UPDATE_URL?: string
  readonly OPENCODE_DESKTOP_UPDATE_REPO?: string
  readonly OPENCODE_DESKTOP_UPDATE_PUBLIC_KEY?: string
  readonly OPENCODE_DESKTOP_ADHOC_SIGN?: string
  readonly OPENCODE_DESKTOP_MANUAL_UPDATE_URL?: string
  readonly OPENCODE_DESKTOP_HIDE_MENU?: string
  readonly OPENCODE_APP_ID?: string
  readonly OPENCODE_SERVICE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
