const DEFAULT_PRODUCT_NAME = "OpenCode"

export const PRODUCT_NAME = import.meta.env.VITE_OPENCODE_DESKTOP_NAME?.trim() || DEFAULT_PRODUCT_NAME

export function brandText(value: string, productName = PRODUCT_NAME) {
  if (productName === DEFAULT_PRODUCT_NAME) return value
  return value.replaceAll(DEFAULT_PRODUCT_NAME, productName)
}
