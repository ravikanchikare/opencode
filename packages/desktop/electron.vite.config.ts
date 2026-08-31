import { defineConfig } from "electron-vite"

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "local" || raw === "dev" || raw === "beta" || raw === "prod") return raw
  if (process.env.OPENCODE_CHANNEL === "latest") return "prod"
  return "dev"
})()

const nodePtyPkg = `@lydell/node-pty-${process.platform}-${process.arch}`
const define = (value: string | undefined) => JSON.stringify(value) ?? "undefined"

const appPlugin = (await import("@opencode-ai/app/vite")).default
const picker = (await import("@brendonovich/vite-plugin-opencode")).default()
const sentry =
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? (await import("@sentry/vite-plugin")).sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        telemetry: false,
        release: {
          name: process.env.SENTRY_RELEASE ?? process.env.VITE_SENTRY_RELEASE,
        },
        sourcemaps: {
          assets: "./out/renderer/**",
          filesToDeleteAfterUpload: "./out/renderer/**/*.map",
        },
      })
    : false

export default defineConfig(({ command }) => ({
  main: {
    resolve: {
      dedupe: ["effect"],
    },
    define: {
      "import.meta.env.OPENCODE_CHANNEL": JSON.stringify(channel),
      "import.meta.env.OPENCODE_DESKTOP_NAME": define(process.env.OPENCODE_DESKTOP_NAME),
      "import.meta.env.OPENCODE_DESKTOP_APP_ID": define(process.env.OPENCODE_DESKTOP_APP_ID),
      "import.meta.env.OPENCODE_DESKTOP_DEEP_LINK_SCHEME": define(process.env.OPENCODE_DESKTOP_DEEP_LINK_SCHEME),
      "import.meta.env.OPENCODE_DESKTOP_ICON_DIR": define(process.env.OPENCODE_DESKTOP_ICON_DIR),
      "import.meta.env.OPENCODE_DESKTOP_UPDATE_URL": define(process.env.OPENCODE_DESKTOP_UPDATE_URL),
      "import.meta.env.OPENCODE_DESKTOP_UPDATE_REPO": define(process.env.OPENCODE_DESKTOP_UPDATE_REPO),
      "import.meta.env.OPENCODE_DESKTOP_UPDATE_PUBLIC_KEY": define(process.env.OPENCODE_DESKTOP_UPDATE_PUBLIC_KEY),
      "import.meta.env.OPENCODE_DESKTOP_ADHOC_SIGN": define(process.env.OPENCODE_DESKTOP_ADHOC_SIGN),
      "import.meta.env.OPENCODE_DESKTOP_MANUAL_UPDATE_URL": define(process.env.OPENCODE_DESKTOP_MANUAL_UPDATE_URL),
      "import.meta.env.OPENCODE_APP_ID": define(process.env.OPENCODE_APP_ID),
      "import.meta.env.OPENCODE_SERVICE_ID": define(process.env.OPENCODE_SERVICE_ID),
    },
    build: {
      minify: command === "build",
      rolldownOptions: {
        input: { index: "src/main/index.ts" },
        // Keep this identical to electron-vite's Node 20.11+ shim. Its regex insertion can
        // corrupt bundled TypeScript, while an output banner places the shim safely.
        output: {
          format: "es",
          banner: `
// -- CommonJS Shims --
import __cjs_mod__ from 'node:module';
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require = __cjs_mod__.createRequire(import.meta.url);
`,
        },
      },
      externalizeDeps: {
        // Bundle the Effect family together; native MessagePack acceleration stays optional and external.
        exclude: ["effect", "@effect/platform-node", "@effect/platform-node-shared", "drizzle-orm"],
        include: [nodePtyPkg, "msgpackr-extract"],
      },
    },
    plugins: [
      {
        name: "opencode:node-pty-narrower",
        enforce: "pre",
        resolveId(s) {
          if (s === "@lydell/node-pty") return nodePtyPkg
          return undefined
        },
      },
    ],
  },
  preload: {
    build: {
      minify: command === "build",
      rolldownOptions: {
        input: { index: "src/preload/index.ts" },
        output: {
          format: "cjs",
          entryFileNames: "[name].js",
        },
      },
    },
  },
  renderer: {
    experimental: {
      bundledDev: true,
    },
    define: {
      "import.meta.env.OPENCODE_VERSION": JSON.stringify(process.env.OPENCODE_VERSION),
      "import.meta.env.VITE_OPENCODE_CHANNEL": JSON.stringify(channel),
      "import.meta.env.VITE_OPENCODE_DESKTOP_NAME": define(process.env.OPENCODE_DESKTOP_NAME),
      "import.meta.env.VITE_OPENCODE_DESKTOP_DEEP_LINK_SCHEME": define(process.env.OPENCODE_DESKTOP_DEEP_LINK_SCHEME),
      "import.meta.env.VITE_OPENCODE_DESKTOP_SUPPORT_URL": define(process.env.OPENCODE_DESKTOP_SUPPORT_URL),
    },
    plugins: [{ ...picker, transformIndexHtml: undefined }, appPlugin, sentry],
    publicDir: "../../../app/public",
    root: "src/renderer",
    build: {
      minify: command === "build",
      sourcemap: true,
      rolldownOptions: {
        input: {
          main: "src/renderer/index.html",
        },
      },
    },
  },
}))
