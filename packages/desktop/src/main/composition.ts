export type DesktopComposition = {
  /**
   * Runs after application environment initialization, before every initial
   * service connection and reconnect. A rejection prevents that connection.
   */
  beforeServiceConnect?: () => void | Promise<void>
}

let composition: DesktopComposition = {}

/** Register before evaluating the desktop main entry. Unset hooks preserve stock behavior. */
export function configureDesktopComposition(value: DesktopComposition) {
  composition = { ...value }
}

export async function prepareServiceConnection() {
  await composition.beforeServiceConnect?.()
}
