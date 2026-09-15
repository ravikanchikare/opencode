import { expect, test } from "bun:test"
import { shouldImportLoginShellEnvironment } from "./environment-policy"

test("imports the login shell environment outside an isolated test profile", () => {
  expect(
    shouldImportLoginShellEnvironment({
      packaged: false,
      onboardingTest: false,
      testRoot: undefined,
      testDisableShellEnvironment: "1",
    }),
  ).toBe(true)
  expect(
    shouldImportLoginShellEnvironment({
      packaged: true,
      onboardingTest: true,
      testRoot: "/tmp/opencode-test",
      testDisableShellEnvironment: "1",
    }),
  ).toBe(true)
})

test("can suppress login shell import for an isolated test profile", () => {
  expect(
    shouldImportLoginShellEnvironment({
      packaged: false,
      onboardingTest: true,
      testRoot: undefined,
      testDisableShellEnvironment: "1",
    }),
  ).toBe(false)
  expect(
    shouldImportLoginShellEnvironment({
      packaged: false,
      onboardingTest: false,
      testRoot: "/tmp/opencode-test",
      testDisableShellEnvironment: "1",
    }),
  ).toBe(false)
})

test("keeps login shell import enabled for isolated tests by default", () => {
  expect(
    shouldImportLoginShellEnvironment({
      packaged: false,
      onboardingTest: false,
      testRoot: "/tmp/opencode-test",
      testDisableShellEnvironment: undefined,
    }),
  ).toBe(true)
})
