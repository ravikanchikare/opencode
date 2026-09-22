---
name: land-fork
description: >-
  Fork-side steps for landing OpenCode changes to origin/v2: shape and
  validate the stack, publish, and synchronize the fork primary. The
  Starter's land skill runs these as part of every landing.
---

Land only this thread's changes. Never discard, stash, reset, or commit
another task's work, and never touch other branches or worktrees.

## 1. Orient

- If `git remote get-url local` succeeds, this is a Delta-managed checkout and
  the primary checkout is that path without `/.git`. Otherwise this is the
  primary checkout.
- `git remote get-url origin` must be
  `git@github.com:ravikanchikare/opencode.git`. Checkouts prepared before
  `.agents/prepare` set it need `.agents/prepare` rerun (or `git remote set-url`).
- `git fetch origin --tags` and `git fetch upstream v2` (`.agents/prepare`
  adds `upstream`; add it if missing). Record `old=$(git rev-parse origin/v2)`.
- Inspect status, branch, `git log --oneline upstream/v2..HEAD`, and the Delta
  review verdict. Identify exactly which commits and paths belong to this
  thread. In the primary checkout, stage only those paths; if local `v2`
  carries unpublished commits that are not this thread's, stop and ask.

## 2. Shape the stack

Follow "Landing a topic" in the "Fork" section at the end of `AGENTS.md`:
rebase this thread's commits onto `origin/v2` and squash them to one
upstream-style commit, or a short Brain → Face → Desktop series for split
cross-track work. Keep the range linear. A landing adds commits on top of
`origin/v2`. Folding into, rewording, or rebasing commits already there is
"Rewriting published history" (and "Upstream sync" for `upstream/v2`); do it
only when asked.

## 3. Validate

- The checks for each touched track in `AGENTS.md` "Fork"; the pre-push hook
  also runs `bun run check`.
- `git diff --check upstream/v2...HEAD`.
- `git log --merges upstream/v2..HEAD` prints nothing.

## 4. Publish (explicit approval required)

`local` is never the publication target.

- If `origin/v2` (`$old`) is an ancestor of `HEAD`:
  `git push origin HEAD:v2`.
- Otherwise the branch is being rewritten, which is allowed only as
  "Rewriting published history" in `AGENTS.md`. Archive the old tip first so
  existing Starter pins stay fetchable, then force with a lease:

  ```bash
  git push origin "${old}:refs/tags/archive/v2-$(date +%Y%m%d)-${old:0:10}"
  git push --force-with-lease=v2:"$old" origin HEAD:v2
  ```

- Confirm `git ls-remote origin refs/heads/v2` equals `git rev-parse HEAD`.
  Do not sync any other checkout until it does.

## 5. Synchronize the primary checkout

Without asking. From a Delta-managed checkout, first try
`git push local HEAD:v2`: Delta's `local` remote uses
`receive.denyCurrentBranch=updateInstead`, so a fast-forward updates the
primary's `v2` and files together and is refused when the primary is dirty.
Otherwise, or when the push is refused, in the primary checkout run
`git fetch origin --tags`, then

- `v2` checked out: `git merge --ff-only origin/v2`. After a rewrite, if
  local `v2` equals `$old` (nothing local-only; the archive tag preserves it),
  use `git reset --keep origin/v2`, which keeps uncommitted work and refuses
  when it overlaps.
- `v2` not checked out: `git fetch origin v2:v2` (fast-forward only); after a
  rewrite, `git branch -f v2 origin/v2` only when local `v2` equals `$old`.
- Anything else — local-only commits, overlapping edits — stop and report.
  Never hard-reset.

After a rewrite this syncs only this Mac's primary. Other Delta-managed
checkouts and other Macs' clones follow step 7 of "Rewriting published
history" in `AGENTS.md`; the Starter pin commit tells them the archive tag and
the new SHA.

## 6. Report

The published 40-character SHA, archive tag if any, checks run, what was not
verified, and the primary checkout's resulting state. After a rewrite, name the
other checkouts and Macs that still need step 7. The Starter's `land`
skill owns the pin update; do not edit the Starter pin from here.
