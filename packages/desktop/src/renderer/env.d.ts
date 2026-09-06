import type { ElectronNative } from "../preload/types"

declare global {
  interface ImportMetaEnv {
    readonly OPENCODE_NOTIFICATION_ICON: string
  }

  interface Window {
    electron: ElectronNative
    __OPENCODE__?: {
      deepLinks?: string[]
    }
  }
}
