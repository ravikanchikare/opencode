import electron, { type Cookie, type CookiesSetDetails, type Session } from "electron"

// A persistent profile is a cookie jar, not a shared partition: each attachment keeps its own
// partition because the partition carries that session's proxy and file:// guard. The jar seeds
// every new attachment and receives the cookie changes pages make, which also reach the other
// attachments on the same profile.

export function cookieURL(cookie: Pick<Cookie, "domain" | "path" | "secure">) {
  return `${cookie.secure ? "https" : "http"}://${(cookie.domain ?? "").replace(/^\./, "")}${cookie.path ?? "/"}`
}

export function cookieDetails(cookie: Cookie): CookiesSetDetails {
  return {
    url: cookieURL(cookie),
    name: cookie.name,
    value: cookie.value,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    // A host-only cookie must stay host-only (and __Host- cookies reject a domain).
    ...(cookie.hostOnly ? {} : { domain: cookie.domain }),
    ...(cookie.session || cookie.expirationDate === undefined ? {} : { expirationDate: cookie.expirationDate }),
  }
}

/**
 * Whether a change a page made should reach the jar and the other attachments. An overwrite's
 * removal half is followed by the new value; expiry and eviction happen locally in each partition.
 * Removals a site asked for (logout) do propagate.
 */
export function cookieChangeShared(cause: string, removed: boolean) {
  return !removed || cause === "explicit" || cause === "expired-overwrite"
}

export function cookieKey(cookie: Pick<Cookie, "name" | "domain" | "path" | "value">, removed: boolean) {
  return [cookie.name, cookie.domain, cookie.path, removed ? "" : cookie.value, removed ? "removed" : "set"].join("\n")
}

const same = (a: Cookie, b: Cookie) =>
  a.name === b.name && a.domain === b.domain && a.path === b.path && !!a.hostOnly === !!b.hostOnly

export function createCookieJars() {
  const members = new Map<string, Set<Session>>()
  // Changes this module wrote, so their `changed` events are not mirrored again.
  const echoes = new WeakMap<Session, Set<string>>()

  async function apply(target: Session, cookie: Cookie, removed: boolean) {
    const url = cookieURL(cookie)
    const current = (await target.cookies.get({ url, name: cookie.name })).find((item) => same(item, cookie))
    if (removed ? !current : current?.value === cookie.value && current.expirationDate === cookie.expirationDate) return
    const pending = echoes.get(target) ?? new Set()
    echoes.set(target, pending)
    const key = cookieKey(cookie, removed)
    pending.add(key)
    await (removed ? target.cookies.remove(url, cookie.name) : target.cookies.set(cookieDetails(cookie))).catch(() =>
      pending.delete(key),
    )
  }

  return {
    /** Seeds `partition` from the jar, then shares its cookie changes until the returned leave(). */
    async join(jarPartition: string, partition: string) {
      const jar = electron.session.fromPartition(jarPartition)
      const member = electron.session.fromPartition(partition)
      for (const cookie of await jar.cookies.get({})) await apply(member, cookie, false).catch(() => undefined)
      const group = members.get(jarPartition) ?? new Set()
      members.set(jarPartition, group)
      group.add(member)
      const changed = (_event: Electron.Event, cookie: Cookie, cause: string, removed: boolean) => {
        if (echoes.get(member)?.delete(cookieKey(cookie, removed))) return
        if (!cookieChangeShared(cause, removed)) return
        for (const target of [jar, ...group])
          if (target !== member) void apply(target, cookie, removed).catch(() => undefined)
      }
      member.cookies.on("changed", changed)
      return () => {
        member.cookies.off("changed", changed)
        group.delete(member)
        if (!group.size) members.delete(jarPartition)
        void jar.cookies.flushStore().catch(() => undefined)
      }
    },
  }
}
