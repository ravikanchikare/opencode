# Plugin options and API domain selection

Status: proposed, 2026-09-06. Implementation has not started.

## Outcome

Users configure an existing packaged plugin by stable ID through native OpenCode
configuration. A generic Settings editor exposes a multi-select option. Workbench
uses this to select raw DevRev API domains without configuring Builder, Workflow
Builder, or Runner.

## Verified starting point

At fork `82c8101383359780f03491f50c271ff04ec503f5`:

- `packages/core/src/plugin/supervisor.ts` treats matching ID entries as enable
  selectors and ignores their options.
- `packages/core/src/plugin/module.ts` captures load-operation options in the
  generation effect. A wrapper that only replaces host options is insufficient.
- `packages/schema/src/config/plugin.ts` already accepts package/options entries.
- The native Plugins panel lists inventory/failures but has no option editor.
- Starter seed wrappers merge embedded options after runtime options, making
  embedded values authoritative.

Revalidate these facts against upstream before implementation. The fetched
upstream ref advanced to `33f48f36c9` during handoff preparation; this worktree
starts from local fork v2, not from an already rebased implementation stack.

## Native seam

Support exact-ID option overrides for already source-loaded plugins, including
packaged plugins, without a second load or duplicate plugin registration. Reuse
existing configuration, source observation, generation activation, and teardown.
Preserve ordinary package loading and string enable/disable selectors.

Resolve effective options before plugin setup and include them in generation
identity. Later values override earlier values by key; arrays replace. Removing
an override restores inherited values. Avoid implicit deep merging. Define and
test selector ordering and ambiguous wildcard-with-options behavior; exact IDs
are the required feature. Do not broaden configuration of SDK/instance/builtin
plugins unless necessary and explicitly justified.

Provide a narrow generic multi-select option descriptor: key, label, description,
available choices, and default value. Validate at the owning boundary. Choices
must be readable even when none are selected. Expose effective value, inheritance,
scope, and activation failure separately from requested configuration. Reuse
existing configuration APIs where adequate; add only missing typed operations.
Do not expose arbitrary secret option values through a generic read endpoint.

## UI

Use Settings → Plugins → plugin details → configurable options. Workbench's
DevRev API detail labels its multi-select “API domains”. Reuse the same editor
in project Extensions → Plugins; do not add a new top-level tab or replace the
Settings surface.

- General scope edits defaults for the selected server's projects.
- Project scope replaces the inherited domain list for that project.
- Show scope and inheritance; “Use default selection” removes the override.
- Display domain labels/descriptions and optionally included tool counts.
- Support select-all-available and clear-all without individual endpoint toggles.
- Persist through native configuration, then await activation and refresh effective
  state. Show applying/failure state; a saved value alone does not mean it is active.
- Keep failed/disabled plugin settings understandable without re-enabling the plugin
  implicitly. Establish how descriptors remain available for these states.

Native host code contains no DevRev domain names or domain-selection logic.
Starter navigation remains declarative customization. No localStorage mirror,
new settings database, or plugin-owned config watcher.

## Starter contract

`devrev.api` consumes a proposed `domains` list:

- omitted: distribution default (preserve existing availability initially);
- empty: no raw API tools;
- explicit list: only those domains;
- unknown/unavailable selection: actionable validation feedback, never expansion.

The effective tool set is build-exposed operations intersected with selected
domains, then subject to native permissions. Generate choice metadata from the
same catalog, independently of the filtered live registry. Domain defaults must
be overridable; do not globally reverse seed-option precedence for unrelated
policies. Preserve namespaces, tool names, and domain permission actions.

Filter before registration so disabled tools leave Code Mode search and catalog
context. Do not cancel already-running calls or claim selection is a security
firewall. Higher-level plugins call their own clients, retain their permissions,
and never consume this raw-domain list. Their tools and skills remain independent.

## Non-goals

No global API firewall, per-endpoint UI, new permission system, arbitrary plugin
UI framework, live DevRev tests, or automatic publication. API-plugin consolidation
is a prerequisite owned by its existing task; coordinate instead of duplicating it.
