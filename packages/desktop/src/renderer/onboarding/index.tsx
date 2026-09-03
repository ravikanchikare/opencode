import {
  getAppComposition,
  ServerConnection,
  ServerProvider,
  useServers,
  useTabs,
  type OnboardingSurfaceProps,
  type ProviderConnectionBannerSurfaceProps,
} from "@opencode-ai/app/desktop"
import { createSignal, onMount, Show, type Component } from "solid-js"
import type { ElectronAPI } from "../api-types"

export function DesktopFirstLaunchOnboarding(props: {
  api: ElectronAPI
  serverKey: ServerConnection.Key
  initialUrl: string
}) {
  const server = useServers()
  const tabs = useTabs()
  const composed = getAppComposition().onboarding
  const banner = getAppComposition().providerConnectionBanner
  const [surface, setSurface] = createSignal(false)

  onMount(() => {
    void runFirstLaunchOnboarding()
  })

  async function runFirstLaunchOnboarding() {
    try {
      const pending = await props.api.isFirstLaunchOnboardingPending()
      if (!pending) return

      await Promise.all([tabs.ready.promise, tabs.recentReady.promise].map((p) => p ?? Promise.resolve()))

      const shouldTrigger =
        props.initialUrl === "/" && tabs.store.length === 0 && server.list.every(ServerConnection.builtin)

      console.info("[desktop-onboarding] first launch onboarding evaluated", {
        pending,
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
    } catch (error) {
      console.error("[desktop-onboarding] first launch onboarding failed", error)
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
      tabs.select(await tabs.newDraft({ server: props.serverKey, directory }))
    } catch (error) {
      console.error("[desktop-onboarding] finishing first launch onboarding failed", error)
    } finally {
      setSurface(false)
    }
  }

  if (!composed && !banner) return null
  const connection = () => server.list.find((item) => ServerConnection.key(item) === props.serverKey)
  return (
    <Show when={connection()} keyed>
      {(connection) => (
        <ServerProvider conn={connection}>
          <ComposedProviderConnectionBanner component={banner} show={() => !surface()} />
          <ComposedOnboarding component={composed} show={surface} complete={complete} />
        </ServerProvider>
      )}
    </Show>
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
