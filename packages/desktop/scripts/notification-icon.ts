import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export function notificationIcon(directory: string | undefined, channel: "local" | "dev" | "beta" | "prod") {
  const root = fileURLToPath(new URL("..", import.meta.url))
  const selected = directory?.trim()
  // Stock resources/icons is staged by copy-icons.ts. Read its channel source
  // so loading the Vite config does not require a desktop prebuild.
  const icons =
    !selected || selected === "icons"
      ? path.join(root, "icons", channel === "local" ? "dev" : channel)
      : path.isAbsolute(selected)
        ? selected
        : path.join(root, "resources", selected)
  // Embed at build time: notifications must work offline and after the app is
  // moved away from the build machine's distribution asset directory.
  return `data:image/png;base64,${readFileSync(path.join(icons, "icon.png")).toString("base64")}`
}
