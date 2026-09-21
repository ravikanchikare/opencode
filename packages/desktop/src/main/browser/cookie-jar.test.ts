import { expect, test } from "bun:test"
import type { Cookie } from "electron"
import { cookieChangeShared, cookieDetails, cookieKey } from "./cookie-jar"

const cookie = (input: Partial<Cookie>): Cookie => ({
  name: "auth0",
  value: "v",
  domain: "auth.example.com",
  hostOnly: true,
  path: "/",
  secure: true,
  httpOnly: true,
  session: false,
  expirationDate: 2_000_000_000,
  sameSite: "no_restriction",
  ...input,
})

test("host-only cookies are copied without a domain, domain cookies keep theirs", () => {
  expect(cookieDetails(cookie({}))).toEqual({
    url: "https://auth.example.com/",
    name: "auth0",
    value: "v",
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "no_restriction",
    expirationDate: 2_000_000_000,
  })
  const shared = cookieDetails(cookie({ domain: ".example.com", hostOnly: false, secure: false, path: "/a" }))
  expect(shared.url).toBe("http://example.com/a")
  expect(shared.domain).toBe(".example.com")
})

test("session cookies stay session cookies", () => {
  expect(cookieDetails(cookie({ session: true, expirationDate: undefined })).expirationDate).toBeUndefined()
})

test("only page-made sets and requested removals are shared", () => {
  expect(cookieChangeShared("inserted", false)).toBe(true)
  expect(cookieChangeShared("explicit", false)).toBe(true)
  expect(cookieChangeShared("explicit", true)).toBe(true)
  expect(cookieChangeShared("expired-overwrite", true)).toBe(true)
  expect(cookieChangeShared("overwrite", true)).toBe(false)
  expect(cookieChangeShared("expired", true)).toBe(false)
  expect(cookieChangeShared("evicted", true)).toBe(false)
})

test("echo keys distinguish values and removals", () => {
  expect(cookieKey(cookie({}), false)).not.toBe(cookieKey(cookie({ value: "w" }), false))
  expect(cookieKey(cookie({}), true)).toBe(cookieKey(cookie({ value: "w" }), true))
  expect(cookieKey(cookie({}), true)).not.toBe(cookieKey(cookie({}), false))
})
