#!/usr/bin/env bash
set -euo pipefail

UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/anomalyco/opencode.git}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-v2}"
TARGET_BRANCH="${TARGET_BRANCH:-v2}"
REMOTE_NAME="${REMOTE_NAME:-origin}"

upstream_ref="upstream/$UPSTREAM_BRANCH"

git fetch "$UPSTREAM_URL" "$UPSTREAM_BRANCH:refs/remotes/$upstream_ref"

upstream_tip="$(git rev-parse "$upstream_ref")"
merge_base="$(git merge-base HEAD "$upstream_ref")"

if [ "$merge_base" = "$upstream_tip" ]; then
  echo "Already rebased on latest $upstream_ref ($upstream_tip)"
  exit 0
fi

before_head="$(git rev-parse HEAD)"
fork_files="$(git diff --name-only "$merge_base" HEAD)"
upstream_files="$(git diff --name-only "$merge_base" "$upstream_ref")"

resolve_conflicts() {
  local manual=false
  local conflicted file in_fork in_upstream

  conflicted="$(git diff --name-only --diff-filter=U)"
  if [ -z "$conflicted" ]; then
    return 0
  fi

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    in_fork=false
    in_upstream=false
    echo "$fork_files" | grep -Fxq "$file" && in_fork=true
    echo "$upstream_files" | grep -Fxq "$file" && in_upstream=true

    if [ "$in_fork" = true ] && [ "$in_upstream" = false ]; then
      git checkout --theirs -- "$file"
      git add -- "$file"
      echo "Auto-resolved $file (fork-only change)"
      continue
    fi

    if [ "$in_upstream" = true ] && [ "$in_fork" = false ]; then
      git checkout --ours -- "$file"
      git add -- "$file"
      echo "Auto-resolved $file (upstream-only change)"
      continue
    fi

    echo "Manual conflict required for: $file" >&2
    manual=true
  done <<< "$conflicted"

  if [ "$manual" = true ]; then
    return 1
  fi

  return 0
}

rebase_in_progress() {
  [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]
}

git config rerere.enabled true

if ! git rebase "$upstream_ref"; then
  while rebase_in_progress; do
    if ! resolve_conflicts; then
      echo "Rebase stopped: conflicting changes in the same files on both sides." >&2
      git status --short >&2
      git diff --name-only --diff-filter=U >&2 || true
      git rebase --abort
      exit 1
    fi

    if ! GIT_EDITOR=true git rebase --continue; then
      if rebase_in_progress; then
        continue
      fi
      echo "Rebase failed after auto-resolution." >&2
      git status --short >&2
      git rebase --abort || true
      exit 1
    fi
  done
fi

after_head="$(git rev-parse HEAD)"
if [ "$before_head" = "$after_head" ]; then
  echo "Rebase produced no changes; skipping push"
  exit 0
fi

git push --force-with-lease "$REMOTE_NAME" "HEAD:$TARGET_BRANCH"
