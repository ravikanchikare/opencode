import {
  getAppComposition,
  ServerConnection,
  ServerProvider,
  useCurrentRoute,
  useGlobal,
  useServers,
  useTabs,
  type OnboardingSurfaceProps,
  type ProviderConnectionBannerSurfaceProps,
} from "@opencode/app/desktop"
import { createResource, createSignal, Show, type Component } from "solid-js"
import type { ElectronAPI } from "../api-types"

export function DesktopFirstLaunchOnboarding(props: {
  api: ElectronAPI
  serverKey: ServerConnection.Key
  initialUrl: string
  pending: boolean
  onReady: () => void
}) {
  const server = useServers()
  const global = useGlobal()
  const tabs = useTabs()
  const route = useCurrentRoute()
  const composed = getAppComposition().onboarding
  const banner = getAppComposition().providerConnectionBanner
  const [surface, setSurface] = createSignal(false)

  const [completed] = createResource(async () => {
    await runFirstLaunchOnboarding()
    return null
  })

  async function runFirstLaunchOnboarding() {
    try {
      if (!props.pending) return

      await Promise.all([tabs.ready.promise, tabs.recentReady.promise].map((p) => p ?? Promise.resolve()))

      const shouldTrigger =
        props.initialUrl === "/" &&
        route().type === "home" &&
        tabs.store.length === 0 &&
        server.list.every(ServerConnection.builtin)

      console.info("[desktop-onboarding] first launch onboarding evaluated", {
        pending: props.pending,
        shouldTrigger,
        composed: composed !== undefined,
        initialUrl: props.initialUrl,
        tabs: tabs.store.length,
        servers: server.list.map(ServerConnection.key),
      })

      if (!shouldTrigger) {
        await props.api.finishFirstLaunchOnboarding(false)
        return
      }

      if (composed) {
        setSurface(true)
        return
      }

      await complete()
    } finally {
      props.onReady()
    }
  }

  async function complete(options?: { openProject?: boolean }) {
    const openProject = options?.openProject ?? true
    try {
      const directory = await props.api.finishFirstLaunchOnboarding(openProject)
      if (!openProject || !directory) return

      console.info("[desktop-onboarding] starting first launch draft", { directory })
      const projects = server.projects.forServer(props.serverKey)
      projects.open(directory)
      projects.touch(directory)
      const connection = server.list.find((connection) => ServerConnection.key(connection) === props.serverKey)
      if (connection) {
        const data = global.ensureServerCtx(connection).data
        // Load the initial provider/model state before the draft transition exposes the composer.
        await Promise.all([data.location.provider.sync({ directory }), data.location.model.sync({ directory })])
      }
      tabs.select(await tabs.newDraft({ server: props.serverKey, directory }))
    } finally {
      setSurface(false)
    }
  }

  // Let startup failures reach the app's recovery screen, including its splash boundary.
  if (!composed && !banner) return <>{completed()}</>
  const connection = () => server.list.find((item) => ServerConnection.key(item) === props.serverKey)
  return (
    <>
      {completed()}
      <Show when={connection()} keyed>
        {(connection) => (
          <ServerProvider conn={connection}>
            <ComposedProviderConnectionBanner component={banner} show={() => !surface()} />
            <ComposedOnboarding component={composed} show={surface} complete={complete} />
          </ServerProvider>
        )}
      </Show>
    </>
  )
}

function ComposedOnboarding(props: {
  component: Component<OnboardingSurfaceProps> | undefined
  show: () => boolean
  complete: OnboardingSurfaceProps["complete"]
}) {
  if (!props.component) return null
  return (
    <Show when={props.show()}>
      <props.component complete={props.complete} />
    </Show>
  )
}

function ComposedProviderConnectionBanner(props: {
  component: Component<ProviderConnectionBannerSurfaceProps> | undefined
  show: () => boolean
}) {
  if (!props.component) return null
  return (
    <Show when={props.show()}>
      <props.component />
    </Show>
  )
}
