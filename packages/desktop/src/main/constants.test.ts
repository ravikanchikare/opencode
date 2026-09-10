import { expect, test } from "bun:test"

/**
 * A distribution names itself once, through the same variable the packager and
 * the renderer read. An unset name is not a branded build with a missing value
 * — it is stock OpenCode.
 */
test("the product name falls back to the stock name", async () => {
  const source = await Bun.file(new URL("./constants.ts", import.meta.url)).text()
  expect(source).toContain('export const PRODUCT_NAME = APP_NAME || "OpenCode"')
})
