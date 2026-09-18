export function settingsVersionLines(input: { productVersion?: string; version?: string }) {
  const lines: Array<{ text: string; title?: string }> = []
  if (input.productVersion) lines.push({ text: `v${input.productVersion}` })
  if (input.version) {
    lines.push({
      text: input.productVersion ? input.version : `v${input.version}`,
      title: input.productVersion ? "OpenCode source revision" : undefined,
    })
  }
  return lines
}
