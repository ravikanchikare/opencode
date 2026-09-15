export function shouldImportLoginShellEnvironment(input: {
  packaged: boolean
  onboardingTest: boolean
  testRoot: string | undefined
  testDisableShellEnvironment: string | undefined
}) {
  if (input.packaged) return true
  if (!input.onboardingTest && !input.testRoot) return true
  return input.testDisableShellEnvironment !== "1"
}
