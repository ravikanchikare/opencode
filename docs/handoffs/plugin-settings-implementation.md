# Implementation handoff

Read [the design](plugin-settings-design.md) first.

## Workspaces and ownership

- Prepared fork worktree: `/Users/ravi/code/opencode-plugin-settings`, branch
  `plugin-settings`, based on fork v2.
- Starter repository: `/Users/ravi/code/opencode-enterprise-starter`.
- The API consolidation task was directed to
  `/Users/ravi/code/opencode-enterprise-starter/.delta/worktrees/n27xpdegsn65/opencode-enterprise-starter`.
  Inspect its result and ownership; do not edit that agent's worktree. Create a
  separate starter worktree from the appropriate integrated base when needed.

Follow current AGENTS.md and starter docs/workflow.md. Git was explicitly
authorized in the originating conversation. Preserve unrelated work. This handoff
authorizes implementation and local commits, not pushes, merges, or shared-history
rewrites. Resolve publication authorization before fork/pin integration.

## Sequence

1. Refresh upstream and inspect whether native options/settings support supersedes
   this proposal. Follow fork maintenance instructions in the isolated branch;
   keep shared v2 unchanged. Revalidate the consolidation prerequisite and exact
   starter pin. Record native APIs that can be reused before adding any.
2. Implement exact-ID option resolution and generation identity. Handle precedence,
   removal, config observation, failed activation, and unchanged selector behavior.
   Keep this as one generic logical seam, independent of DevRev.
3. Add the smallest generic option-descriptor/read/write support necessary for the
   Settings editor. Inspect existing config persistence and scope resolution first.
   Preserve unrelated authored config, including plugin options. Determine descriptor
   availability without requiring the domain's tools to be registered.
4. Implement the native multi-select editor in Plugins details and the existing
   project extension context. Reuse host controls and selected-server scope. Include
   inherited/reset behavior and requested-versus-active failure feedback.
5. In the starter worktree, contribute generated domain metadata, validate selection,
   filter raw registrations, and supply overridable defaults. Keep Builder/Runner
   entirely independent. Coordinate with the AI Agents standard-policy change and
   API consolidation; do not restore special cases or old plugin packages.
6. Update architecture, plugin docs, skills, and configuration examples. Amend
   historical ADRs instead of rewriting their original decisions. Clearly distinguish
   build exposure, user availability, and execution permissions.

Ask only for decisions that cannot be resolved from the agreed design and current
code. Explain a material expansion in host API/UI scope before implementing it.

## Validation

Use actual plugin activation and existing test infrastructure, not mocks that
reimplement option resolution. Cover:

- A packaged plugin receives options by ID with exactly one activation instance.
- Ordinary package options and existing selector ordering remain correct.
- Options-only config edits rebuild contributions; removing options restores defaults.
- Arrays replace across scopes; empty selection removes every raw tool.
- Domain choices remain discoverable when all domains are off.
- Config or activation failures are visible and cannot be presented as applied.
- Unavailable/unknown domains cannot enable excluded operations.
- Disabled domains disappear from Code Mode search on the next effective registry;
  re-enabling restores them without duplicates.
- Native permissions remain enforced; Builder/Workflow Builder/Runner operate
  independently of raw-domain selection.
- UI scope, reset, persistence failures, and remote-server selection are tested.

Run affected package tests and `bun typecheck` from package directories. If public
Protocol/Server HttpApi changes, generate the client from `packages/client`; never
edit generated code by hand. Run starter generation, packaging, and relevant host
contracts against the integrated immutable pin at the appropriate integration stage.
Do not claim a dirty fork override as final pin validation.

Do not launch applications, perform real DevRev mutations, or run E2E tests. List
packaged visual testing and live reload validation as remaining next-phase checks.

## Commits and integration

Keep core options, generic Settings support, and starter integration as logical
reviewable changes; tests accompany behavior. Avoid tiny corrective commits.
After explicit publication authorization, follow fork branch → v2 → pushed SHA
→ starter pin → starter main, using the prescribed pin tooling and verification.
Do not rewrite or publish shared history merely because this document mentions it.

Finish with commit IDs, tests, configuration examples, remaining limitations, and
the precise integration/publication state. The proposed small core seam and the
additional UI/API work should be reported separately so fork maintenance cost is
visible.
