import { Browser } from "@opencode/plugin-browser/rpc"
import { Option, Schema } from "effect"
import type { StateStore } from "../storage/state"

const Stored = Schema.fromJsonString(
  Schema.Struct({
    tabs: Schema.Array(Schema.Struct({ id: Browser.TabID, url: Browser.Tab.fields.url })),
    focusedTabID: Schema.NullOr(Browser.TabID),
    profile: Schema.optionalKey(Schema.Struct({ serverKey: Schema.String, id: Schema.String })),
  }),
)
const decode = Schema.decodeUnknownOption(Stored)
const encode = Schema.encodeSync(Stored)
const namespace = "opencode.browser.dat"

export function createBrowserRestoreStore(storage: StateStore) {
  return {
    load(key: string) {
      return Option.getOrElse(decode(storage.get(namespace, key)), () => ({ tabs: [], focusedTabID: null }))
    },
    save(key: string, state: typeof Stored.Type) {
      const value = encode({
        tabs: state.tabs.map((tab) => ({ id: tab.id, url: tab.url })),
        focusedTabID: state.focusedTabID,
        ...(state.profile ? { profile: state.profile } : {}),
      })
      if (storage.get(namespace, key) !== value) storage.set(namespace, key, value)
    },
    remove(key: string) {
      storage.delete(namespace, key)
    },
    clearProfile(profile: { serverKey: string; id: string }) {
      Object.entries(storage.items(namespace).items)
        .filter(([, value]) => {
          const state = decode(value)
          return (
            Option.isSome(state) &&
            state.value.profile?.serverKey === profile.serverKey &&
            state.value.profile.id === profile.id
          )
        })
        .forEach(([key]) => storage.delete(namespace, key))
    },
  }
}
