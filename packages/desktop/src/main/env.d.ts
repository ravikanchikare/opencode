interface ImportMetaEnv {
  readonly OPENCODE_CHANNEL: string
  readonly OPENCODE_VERSION?: string
  readonly OPENCODE_DESKTOP_NAME?: string
  readonly OPENCODE_DESKTOP_APP_ID?: string
  readonly OPENCODE_DESKTOP_DEEP_LINK_SCHEME?: string
  readonly OPENCODE_DESKTOP_ICON_DIR?: string
  readonly OPENCODE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
