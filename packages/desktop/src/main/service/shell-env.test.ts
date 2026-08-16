import { describe, expect, test } from "bun:test"

import { applyPreferredEnv, isNushell, mergeShellEnv, parseShellEnv, resolveUserShell } from "./shell-env"

describe("shell env", () => {
  test("parseShellEnv supports null-delimited pairs", () => {
    const env = parseShellEnv(Buffer.from("PATH=/usr/bin:/bin\0FOO=bar=baz\0\0"))

    expect(env.PATH).toBe("/usr/bin:/bin")
    expect(env.FOO).toBe("bar=baz")
  })

  test("parseShellEnv ignores invalid entries", () => {
    const env = parseShellEnv(Buffer.from("INVALID\0=empty\0OK=1\0"))

    expect(Object.keys(env).length).toBe(1)
    expect(env.OK).toBe("1")
  })

  test("mergeShellEnv keeps explicit overrides", () => {
    const env = mergeShellEnv(
      {
        PATH: "/shell/path",
        HOME: "/tmp/home",
      },
      {
        PATH: "/desktop/path",
        OPENCODE_CLIENT: "desktop",
      },
    )

    expect(env.PATH).toBe("/desktop/path")
    expect(env.HOME).toBe("/tmp/home")
    expect(env.OPENCODE_CLIENT).toBe("desktop")
  })

  test("a branded desktop keeps its identity instead of the shell OpenCode config", () => {
    const env = applyPreferredEnv(
      {
        OPENCODE_APP_ID: "factory",
        OPENCODE_CONFIG_DIR: "/starter/factory-config",
        XDG_CONFIG_HOME: "/starter/config",
        XDG_STATE_HOME: "/starter/state",
      },
      {
        OPENCODE_CONFIG_DIR: "/Users/ravi/.config/opencode",
        XDG_CONFIG_HOME: "/Users/ravi/.config",
        PATH: "/usr/bin",
      },
    )

    expect(env.OPENCODE_APP_ID).toBe("factory")
    expect(env.OPENCODE_CONFIG_DIR).toBe("/starter/factory-config")
    expect(env.XDG_CONFIG_HOME).toBe("/starter/config")
    expect(env.XDG_STATE_HOME).toBe("/starter/state")
    expect(env.PATH).toBe("/usr/bin")
  })

  test("a branded desktop ignores a shell OPENCODE_CONFIG_DIR pointing at OpenCode", () => {
    const env = applyPreferredEnv(
      { OPENCODE_APP_ID: "factory" },
      { OPENCODE_CONFIG_DIR: "/Users/ravi/.config/opencode" },
    )

    expect(env.OPENCODE_CONFIG_DIR).toBeUndefined()
    expect(env.OPENCODE_APP_ID).toBe("factory")
  })

  test("resolveUserShell falls back to the login shell before /bin/sh", () => {
    expect(resolveUserShell("/custom/env-shell", "/bin/zsh")).toBe("/custom/env-shell")
    expect(resolveUserShell(undefined, "/bin/zsh")).toBe("/bin/zsh")
    expect(resolveUserShell(undefined, "unknown")).toBe("/bin/sh")
    expect(resolveUserShell(undefined, undefined)).toBe("/bin/sh")
  })

  test("isNushell handles path and binary name", () => {
    expect(isNushell("nu")).toBe(true)
    expect(isNushell("/opt/homebrew/bin/nu")).toBe(true)
    expect(isNushell("C:\\Program Files\\nu.exe")).toBe(true)
    expect(isNushell("/bin/zsh")).toBe(false)
  })
})
