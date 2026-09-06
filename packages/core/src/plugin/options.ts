export * as PluginOptions from "./options.js"

import { Plugin } from "@opencode-ai/schema/plugin"
import { Option, Schema } from "effect"

const decodeDescriptors = Schema.decodeUnknownOption(Schema.Array(Plugin.OptionDescriptor))

/** Later keys replace earlier keys. Arrays replace; objects are not deep-merged. */
export function merge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  return { ...base, ...override }
}

export function decode(input: unknown) {
  return Option.getOrUndefined(decodeDescriptors(input))
}

export function requireDescriptors(input: unknown) {
  const descriptors = decode(input)
  if (!descriptors) throw new Error("Plugin option descriptors must be an array of multi-select definitions.")
  validate(descriptors)
  return descriptors
}

export function validate(descriptors: readonly Plugin.OptionDescriptor[]) {
  const keys = new Set<string>()
  for (const descriptor of descriptors) {
    if (keys.has(descriptor.key)) throw new Error(`Duplicate plugin option key: ${descriptor.key}`)
    keys.add(descriptor.key)
    const values = new Set<string>()
    for (const choice of descriptor.choices) {
      if (values.has(choice.value))
        throw new Error(`Duplicate choice "${choice.value}" for plugin option ${descriptor.key}`)
      values.add(choice.value)
    }
    for (const value of descriptor.default ?? []) {
      if (!values.has(value))
        throw new Error(`Default "${value}" is not a choice for plugin option ${descriptor.key}`)
    }
  }
}

export function publicValues(
  values: Record<string, unknown>,
  descriptors: readonly Plugin.OptionDescriptor[],
): Record<string, unknown> {
  const secret = new Set(descriptors.filter((descriptor) => descriptor.secret).map((descriptor) => descriptor.key))
  return Object.fromEntries(Object.entries(values).filter(([key]) => !secret.has(key)))
}

export function validateSelection(
  descriptor: Plugin.OptionDescriptor,
  value: readonly string[],
): string | undefined {
  const allowed = new Set(descriptor.choices.map((choice) => choice.value))
  const unknown = value.filter((item) => !allowed.has(item))
  if (unknown.length === 0) return
  return `Unknown ${descriptor.key} selection: ${unknown.join(", ")}`
}

export function apply<T extends { readonly optionValues?: Record<string, unknown>; readonly revision: string }>(
  plugin: T,
  override: Record<string, unknown> | undefined,
): T {
  if (!override || Object.keys(override).length === 0) return plugin
  const optionValues = merge(plugin.optionValues ?? {}, override)
  if (JSON.stringify(plugin.optionValues ?? {}) === JSON.stringify(optionValues)) return plugin
  return {
    ...plugin,
    optionValues,
    revision: JSON.stringify([plugin.revision, optionValues]),
  }
}
