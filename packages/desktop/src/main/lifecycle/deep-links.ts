import { stat } from "node:fs/promises"
import { isAbsolute } from "node:path"

export async function validDeepLinks(urls: string[], scheme: string) {
  const links = await Promise.all(urls.map((url) => validateDeepLink(url, scheme)))
  return links.flatMap((link) => (link.valid ? [link.url] : []))
}

async function validateDeepLink(url: string, scheme: string) {
  let link: URL
  try {
    link = new URL(url)
  } catch {
    console.warn("[desktop-deep-link] ignored malformed deep link", { url })
    return { valid: false, url }
  }
  if (link.protocol !== `${scheme}:` || link.hostname !== "open-project") return { valid: true, url }

  const path = link.searchParams.get("path")
  if (!path || !isAbsolute(path)) {
    console.warn("[desktop-deep-link] ignored open-project link with a missing or relative path", { url })
    return { valid: false, url }
  }

  try {
    if ((await stat(path)).isDirectory()) return { valid: true, url }
  } catch {
    // The path may have been deleted or be inaccessible by the time the link arrives.
  }
  console.warn("[desktop-deep-link] ignored open-project link for a missing directory", { path })
  return { valid: false, url }
}
