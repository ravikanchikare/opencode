import { afterEach, expect, test } from "bun:test"
import { configureDesktopComposition, prepareServiceConnection } from "./composition"

afterEach(() => configureDesktopComposition({}))

test("stock desktop needs no service preparation", async () => {
  await expect(prepareServiceConnection()).resolves.toBeUndefined()
})

test("registration is inert and preparation runs again for every connection", async () => {
  const calls: string[] = []
  const gate = Promise.withResolvers<void>()
  configureDesktopComposition({
    beforeServiceConnect: async () => {
      calls.push("prepare")
      await gate.promise
      calls.push("ready")
    },
  })
  expect(calls).toEqual([])
  const initial = prepareServiceConnection()
  expect(calls).toEqual(["prepare"])
  gate.resolve()
  await initial
  await prepareServiceConnection()
  expect(calls).toEqual(["prepare", "ready", "prepare", "ready"])
})

test("synchronous and asynchronous preparation failures reject the connection boundary", async () => {
  const failure = new Error("distribution preparation failed")
  configureDesktopComposition({
    beforeServiceConnect: () => {
      throw failure
    },
  })
  await expect(prepareServiceConnection()).rejects.toBe(failure)
  configureDesktopComposition({ beforeServiceConnect: () => Promise.reject(failure) })
  await expect(prepareServiceConnection()).rejects.toBe(failure)
})

test("the shared initial/reconnect path prepares before ensuring the service", async () => {
  const source = await Bun.file(new URL("./service/background-service.ts", import.meta.url)).text()
  const connect = source.slice(source.indexOf('const connect = Effect.fn("BackgroundService.connect")'))
  expect(source).toContain('initial: connect("initial")')
  expect(source).toContain('reconnect: connect("reconnect")')
  expect(connect.indexOf("Effect.promise(prepareServiceConnection)")).toBeGreaterThan(0)
  expect(connect.indexOf("Effect.promise(prepareServiceConnection)")).toBeLessThan(
    connect.indexOf("client.Service.ensure("),
  )
})
