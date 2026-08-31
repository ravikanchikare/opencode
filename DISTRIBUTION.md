# Distribution seams

This fork keeps distribution-specific behavior behind a small set of host
seams. Features that are useful to every OpenCode distribution should be
upstreamed and removed from this stack when available in upstream `v2`.

## Identity

Desktop identity is fixed before plugins load. A distribution may set:

- `OPENCODE_DESKTOP_NAME`
- `OPENCODE_DESKTOP_APP_ID`
- `OPENCODE_DESKTOP_DEEP_LINK_SCHEME`
- `OPENCODE_DESKTOP_ICON_DIR`
- `OPENCODE_DESKTOP_SUPPORT_URL`
- `OPENCODE_DESKTOP_UPDATE_REPO` or `OPENCODE_DESKTOP_UPDATE_URL`

`OPENCODE_APP_ID` scopes user data. `OPENCODE_SERVICE_ID` independently scopes
the background service. Keeping them separate lets a distribution share the
user's OpenCode configuration without sharing a server process.

A branded build without its own update feed does not fall back to stock
OpenCode releases.

## Managed plugins

The desktop verifies a distribution-provided plugin manifest and passes the
verified absolute bundle paths to the server. Managed bundles remain in the
application resources directory; they are not copied into user configuration.

Authored plugin selectors cannot remove a managed bundle from inventory.
Activation is separate from delivery: user-toggleable managed plugins may still
be disabled through the stock extension availability controls.

Internal, SDK, and instance plugins remain locked. Enforcement that users must
not disable belongs in an internal plugin, not a managed bundle.

## Renderer composition

`@opencode-ai/app/composition` exposes the renderer surfaces that must be
selected before the stock renderer starts. A distribution entry registers its
composition, then statically imports the desktop renderer. Do not replace this
sequence with a dynamic import: bundled development serves dynamic targets
through a lazy wrapper that is incompatible with the renderer's top-level
await.

Composition is limited to presentation and defaults. OpenCode continues to own
provider state, extension state, references, projects, workspaces, sessions,
permissions, and persistence.

## Generic host capabilities

The following changes are generic and should be proposed upstream:

- guarded plugin permission assertions;
- managed reference candidates and repository access validation;
- global extension defaults with location overrides;
- the CodeMode `tools.search` compatibility alias;
- the desktop composition API.

Protocol changes and their generated clients belong in the same commit. Run
`bun run generate` from `packages/client` after changing Protocol or Server
`HttpApi`.

## Rebase checklist

1. Rebase each functional commit onto the latest upstream `v2`.
2. Preserve upstream signing, packaging, and service lifecycle changes.
3. Keep managed plugin delivery outside authored configuration.
4. Keep extension inventory visible when activation is disabled.
5. Reuse plugin generation replacement for activation changes.
6. Keep skill candidates in inventory and filter only effective access.
7. Verify package tests and typechecks from their package directories.
8. Advance downstream pins only after the rewritten fork tip is published.
