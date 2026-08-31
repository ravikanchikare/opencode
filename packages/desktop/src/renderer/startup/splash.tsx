import { Splash } from "@opencode-ai/ui/logo"

import "./splash.css"

export function LoadingSplash(props: { deep: boolean }) {
  return (
    <div
      class="h-dvh w-screen flex flex-col items-center justify-center"
      classList={{
        "bg-v2-background-bg-deep": props.deep,
        "bg-v2-background-bg-base": !props.deep,
      }}
    >
      <Splash class="desktop-startup-pinwheel w-16 h-20" />
    </div>
  )
}
