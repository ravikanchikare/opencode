/** Connection details for a local OpenCode service. */
export type Endpoint = {
  /** Base URL of the service. */
  readonly url: string
  /** Authentication required by the service, when configured. */
  readonly auth?: {
    /** HTTP authentication scheme. */
    readonly type: "basic"
    /** Basic authentication username. */
    readonly username: string
    /** Basic authentication password. */
    readonly password: string
  }
}

/** Options used to discover the local OpenCode service. */
export type DiscoverOptions = {
  /** Absolute registration file path. Defaults to the XDG state directory. */
  readonly file?: string
  /** Required exact service version or compatibility predicate. */
  readonly version?: string | ((version: string) => boolean)
}

/** Reason ensuring the service requires a new process. */
export type EnsureReason = "missing" | "version-mismatch"

/** Options used to ensure the local OpenCode service is running. */
export type EnsureOptions = DiscoverOptions & {
  /** Service command and arguments. Defaults to `opencode serve --service`. */
  readonly command?: ReadonlyArray<string>
  /** Environment variables added to the inherited service process environment. */
  readonly env?: Readonly<Record<string, string>>
  /** Called once before spawning a new service process. */
  readonly onStart?: (reason: EnsureReason, previousVersion?: string) => void
}

/** Options used to stop the local OpenCode service. */
export type StopOptions = {
  /** Absolute registration file path. Defaults to the XDG state directory. */
  readonly file?: string
}

/** Contents of the local service registration file. */
export type Info = {
  /** Unique service instance identifier. */
  readonly id?: string
  /** OpenCode version served by the process. */
  readonly version?: string
  /** Base URL advertised by the service. */
  readonly url: string
  /** Operating system process identifier. */
  readonly pid: number
  /** Private service password, when authentication is enabled. */
  readonly password?: string
}

const DEFAULT_SERVICE_ID = "opencode"
const slug = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "-")

export function serviceID(env: Record<string, string | undefined> = process.env) {
  return env.OPENCODE_SERVICE_ID?.trim() || DEFAULT_SERVICE_ID
}

export function registrationFilename(channel: string, service = serviceID()) {
  const stable = channel === "latest" || channel === "dev" || channel === "beta" || channel === "next"
  const identity = service === DEFAULT_SERVICE_ID ? "" : `-${slug(service)}`
  return stable ? `service${identity}.json` : `service${identity}-${slug(channel)}.json`
}
