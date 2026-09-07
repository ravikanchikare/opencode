# Fork restack review

## Status

The fork stack has been rebuilt on `restack-fork`. The user authorized
publication before Starter integration testing because there are no users yet.
The stock Electron Settings smoke passes; Starter's composed host workflow
remains unverified because its checkout is not attached to this thread.
No Starter pin or primary checkout has been changed.

The original publication was based on `a55dc8c84a`. A subsequent fork restack
replays its complete retained range over `upstream/v2`
`8a5709324f847e5cb9fd1bb8b088f5e8330630a6`. The rewritten fork `v2` is not
published until the rebase validation completes.

The implementation tip before this review record is
`ea6496b6b3f09288f099d9e8c7434f5d4aed6b8d`. This document's commit adds no runtime
changes. Use the eventual published commit, not that implementation tip, for
Starter's immutable pin.

## Baseline and recovery

| Ref | SHA |
| --- | --- |
| Original fetched `origin/v2` | `e524b3ac177f204a13a68b04d66c1669e4131fb4` |
| Fetched `upstream/v2` | `a55dc8c84a5594da99b2c9dc2ae02198414441f2` |
| Merge base | `44513bd0b002edc79f5bd2a3f6b0d02d9d727744` |

Both of these refs were pushed atomically before rewriting and verified against
the original fork tip:

- `refs/heads/archive-v2-20260907-223738`
- `refs/tags/archive-v2-20260907-223738` (annotated; peeled target is the old tip)

The initial worktree was clean. All rewriting took place in this attached
worktree, on a task branch. Local checkpoints `restack-consolidated` and
`restack-replayed` retain the intermediate consolidation and first upstream
replay. The published archives must remain.

## Upstream V2 rebase

| Ref | SHA |
| --- | --- |
| Fork `v2` before this rebase | `6dc77951485e03d94a84b05aaf211e55ca68f97a` |
| Current fetched `upstream/v2` | `8a5709324f847e5cb9fd1bb8b088f5e8330630a6` |
| Rebase merge base | `a55dc8c84a5594da99b2c9dc2ae02198414441f2` |

Before rewriting, the following annotated tag and branch were pushed, both
targeting the published fork tip:

- `refs/heads/archive-v2-20260908-213045`
- `refs/tags/archive-v2-20260908-213045`

All 16 fork commits replayed in their existing order. The range-diff maps each
old commit to its rewritten counterpart; no fork behavior was dropped.
The final upstream advance adds only the worktree configured-path correction;
it replayed without conflicts.

The composition conflict retains upstream's disconnected-server screen and the
fork's overlay, while keeping `defaultServer` optional for the web entrypoint.
The configured-model hook remains the source of catalog defaults because it
loads the document-backed configuration and exposes readiness; it subsumes
upstream's direct default lookup. The updater conflict retains upstream's
hosted generic feeds as stock defaults and the fork's branded distribution
override seam. The provider adapter now accepts upstream's differential-update
argument and deliberately ignores it because a packaged provider owns its own
staging implementation.

## Decisions and complete old-to-new mapping

The approved migration adopts upstream's `@opencode/*` scope and `services/`
layout. It does not add a reverse migration or a second package identity.
Starter must migrate with the host.

No complete behavior patch was shown to be obsolete. Absorbed commits below
lose their separate position in the stack, not their behavior or tests.

| Old commit | New commit(s) | Review and disposition |
| --- | --- | --- |
| `f7066557f2` | `f0402768ab` | Keep distribution state and service identity. Upstream still defaults to stock identity; its package migration does not isolate distribution state. Use an unaliased import/re-export for `serviceID`. |
| `5619e4f16e` | `95858b34a9` | Keep compatible-responses bundling and its test. Upstream `42bccc301e` adds named providers and `3cf197a309` removes remapping, but neither adds this entrypoint to the bundled loader. |
| `61948fffe6` | `67f68c005b` | Keep the `tools.search` compatibility alias and registered-search precedence. Upstream `fcddc84225` adds zero-argument calls, not this alias. Both test suites pass together. |
| `d6c69dce8e` | `7faef9b57e` | Keep plugin permission assertions and caller explanations. Upstream filesystem-policy and webfetch-permission changes do not expose this plugin-domain method. |
| `a1777faf44` | `75a60f0d28` | Keep packaged paths entering ordinary native selectors. No additional source variant or distribution-specific activation policy is introduced. |
| `1a420169ef` | `5f1f67ea95`, `6292735ffb` | Split external-harness source admission from persistent scoped availability/inventory. Direct admission tests stay with admission; inventory, API, persistence, and cross-feature tests stay with availability. Upstream MCP skill authentication is complementary, not a replacement. |
| `ae6b215d08` | `ffc7022452`, `e43296f74b` | Keep app composition/branding and native extension destinations. Preserve upstream browser attachments around the composed shell. Extract the three existing Hebrew credential labels into their own commit, unchanged, rather than silently dropping unrelated translations. |
| `696383d329` | `a0f71550f4` | Keep generic packaging and explicitly selected updater providers. Upstream macOS development branding does not provide the distribution contract. Absorb the two desktop corrections below into this seam. |
| `4a985a1977` | `fb6075bf7e` | Keep fork/archive/worktree workflow and preparation hook. Update instructions to reflect the approved upstream scope/layout. |
| `e4ed9fb6cb` | `3d05099850` | Consolidate exact-ID option activation, API, UI, client output, and documentation into one end-to-end behavior commit. Keep effective versus requested values and option-only reload tests. |
| `7359dabdf9` | `3d05099850` | Absorb option editor and API into the behavior they expose. |
| `11bc5a0d92` | `3d05099850` | Absorb generated client output; regenerate from the current contract instead of maintaining a standalone generated-code patch. |
| `37e4b6aef5` | `3d05099850` | Absorb exact-ID documentation; Git relocates it to `services/www`. |
| `0e6973bcda` | `a0f71550f4` | Absorb deferred quit retry into desktop lifecycle/packaging. Preserve its code exactly. |
| `871d472c01` | `21dd0b2f09` | Keep catalog-default composer selection and its real model-selection E2E fixture. Upstream new-session worktree loading is a different behavior. |
| `e3cc4597f5` | `84fab20f84` | Keep opt-out provider promotions and unknown-release-date model visibility for gateway catalogs. Preserve stock defaults. |
| `e91d639661` | `a0f71550f4` | Absorb distribution notification icons into packaging, including serve/build configuration and notification tests. |
| `e524b3ac17` | `ea6496b6b3` | Keep authored plugin identity, choice/tool metadata, searchable details, and read-only inventory behavior. Regenerate metadata snapshots in this commit. |

The final implementation range has 15 linear commits over the recorded upstream
tip. This review record is a separate documentation concern.

## Equivalence and intentional changes

1. The initial history-only option consolidation changed 18 commits to 15 on
   the old base. Its tip was
   `700865f0b3c21b9b1c7c1c859948948b9379a5f7`.
   Both it and the original fork have the identical tree
   `d601d33ceb7a6d7afdacaf3597cf71c1e564c1bf`.
2. The resolved skills patch was split without changing its combined staged
   tree: before and after splitting it was
   `77a32e224f90b76487b5adccef9f6458768cafd0`.
3. The later desktop consolidation leaves all implementation files identical
   to `restack-replayed`. The only final differences from that checkpoint are
   restoration of the original three Hebrew labels and regenerated OpenAPI
   snapshots. An explicit `git diff --exit-code` excluding those four files
   passed.
4. Comparing the aggregate old and new patch's added/deleted lines, normalized
   for package scopes and the website move and excluding OpenAPI snapshots,
   leaves only:
   - the approved root instruction update;
   - the unaliased `serviceID` import/re-export;
   - indentation of the shell overlay inside upstream's
     `BrowserAttachmentsProvider`.
5. Generated OpenAPI was stale in the old stack. Regeneration adds the existing
   plugin-option endpoint, option schemas, and plugin/tool metadata to Protocol
   and both website copies. It also removes a redundant duplicate
   `SessionNotFoundErrorEncoded` alternative emitted in the old snapshot.
   These are generated-document corrections, not new handler behavior.

Review commands:

```sh
git range-diff --creation-factor=90 \
  44513bd0..e524b3ac a55dc8c84a..ea6496b6
git diff a55dc8c84a..ea6496b6
git diff --check a55dc8c84a..HEAD
git log --reverse --oneline a55dc8c84a..HEAD
```

Scope-only conflicts were resolved inside their owning commits. The published
archives, not moving remote-tracking branches, are the source of the old range.

## Validation

All commands ran in the attached fork worktree. Tests/typechecks ran from their
package directories, not the repository root.

| Check | Result |
| --- | --- |
| Root `bun install --frozen-lockfile` | Passed initially and after the complete replay; lockfile unchanged |
| `bun typecheck` | Passed in Core, App, Desktop, CodeMode, Client, Protocol, Schema, Server, Plugin, CLI, Util, and UI |
| Core provider, permission, managed-plugin, skill admission/availability suites | 144 passed across 9 files on the rebased prefix |
| Core exact-ID options and plugin suites | 31 passed |
| CodeMode alias and tool-path suites | 76 passed |
| App `test:unit` | 872 passed, 1 skipped |
| App `test:browser` | 128 passed |
| App focused option/catalog/provider tests | 32 passed |
| Desktop packaging/updater/managed-plugin/notification suites | 79 passed |
| Client solid data | 25 passed |
| Plugin metadata adapter | 1 passed |
| UI additional icons | 1 passed |
| Util global paths | 4 passed |
| CLI service integration, separate test process | 24 passed, approximately 84 seconds |
| Server scoped skill HTTP integration, separate test process | 1 passed |
| Core Session prompt integration, separate test process | 42 passed |
| Model-selection E2E, isolated ports and one worker | 2 passed |
| Client, Protocol, website `check:generated` | Passed after regeneration |
| Website `bun typecheck` and `bun run build` | Passed, including link validation |
| `git diff --check` | Passed |

The focused prefix runs are not a claim that every package's complete suite was
run. The single App unit skip is reported rather than counted as a pass.

### Upstream V2 rebase validation

| Check | Result |
| --- | --- |
| Root `bun install --frozen-lockfile` | Passed after fetching `upstream/v2` |
| Package `bun typecheck` | Passed in App, Desktop, Core, Client, Server, Protocol, and CodeMode |
| App composition and extension settings | 27 passed |
| Desktop packaging and updater-provider suite | 43 passed |
| Core packaged-plugin, option-config, skill-admission, and enablement suite | 15 passed |
| Client solid data | 25 passed |
| Server scoped-skill HTTP integration | 1 passed |
| Protocol generated contract check | Passed |
| CodeMode tool-runtime suite | 53 passed |
| `git diff --check upstream/v2..HEAD` | Passed |

### Electron / agent-browser smoke

- Launched the development Electron app with a fresh test root, unique
  application/service state identity, disabled protocol registration, and CDP
  port `19337`. It started a fresh isolated background server; no installed
  live server was replaced.
- Main and preload development builds succeeded.
- Agent-browser connected to the actual Electron renderer. The composer
  displayed a catalog model, an empty prompt, and a disabled Send button.
  Navigation to Home showed the project list, Settings, and Help.
- After selecting Settings, Electron logged `before-quit`, completed shutdown,
  and removed its CDP endpoint. The reason for the quit was not established.
  The app was not restarted until the user explicitly authorized a fresh run.
- The authorized retry used stable scratch storage, skipped first-launch
  project creation, and loaded one checksummed local managed-plugin fixture.
  Agent-browser verified Preferences, Extensions (Plugins and Skills), About,
  and navigation back to Home in the actual Electron window. The Plugins list
  displayed the fixture's `restack.smoke` ID. No browser errors were reported,
  and the earlier unexpected quit did not recur.
- Stock Extensions is read-only; composed plugin-option interactions still
  require the Starter host smoke. The retry changes no production code and
  does not establish the cause of the earlier quit.
- After verification, the isolated service was stopped and the smoke Electron
  process was intentionally sent SIGTERM. It completed `before-quit` /
  `will-quit`; the supervised development launcher exited with status 0.
- The first launcher attempt failed before Electron started because its
  inherited terminal temporary directory had expired. Using a stable scratch
  `TMPDIR` allowed the launch above; no source change was needed.
- Stock first-launch onboarding ensured
  `/Users/ravi/Documents/Default Project` exists. The test did not delete that
  directory or determine whether it predated the smoke. Test state itself was
  directed to scratch storage.

## Publication procedure and deferred integration

The user waived the Starter pre-publication gate. The integration work below
remains required later and is not reported as validated.

1. Finish the composed plugin-option smoke in Starter. The stock Electron
   Settings retry passed, but is not evidence for Starter-specific composition.
2. Attach Starter and read its `docs/workflow.md`. Migrate its consumers to
   upstream's package scope and service paths, then validate the host contract.
3. Publish the upstream rebase only with the exact published-fork lease:

   ```sh
   git push origin HEAD:refs/heads/v2 \
     --force-with-lease=refs/heads/v2:6dc77951485e03d94a84b05aaf211e55ca68f97a
   ```

   A lease rejection requires inspecting and preserving new remote work.
   Do not simply substitute a fresh lease.
4. In Starter, use `opencode:bump <published-sha>` and `opencode:sync`, run its
   frozen install, typechecks, tests, and host contracts, then review and
   fast-forward its local `main` before pushing `origin/main`.
5. Inspect primary checkout branches, dirty state, and worktrees before
   synchronization. Do not reset or discard unapproved work. The primary
   checkouts have not been synchronized by this task yet.
