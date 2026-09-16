---
name: land-fork
description: >-
  Land reviewed OpenCode fork changes after explicit approval to publish. Use
  for OpenCode-only landing, or before the Starter pin is updated.
metadata:
  delta-action: land
---

Land only reviewed changes from this thread. Inspect status, remotes, branch
base, and the Delta review verdict before making commits or publishing.

When rebasing or force-updating a shared fork branch, first preserve its old
published tip with the repository's archive-tag procedure. Compare the complete
fork-only range with `upstream/v2`, retain only generic reusable seams, then run
the affected package tests and typechecks plus `git diff --check`. With explicit
user approval, publish the fork branch to `origin/v2`; do not use `local` as
the publication target.

When a Starter change depends on the fork revision, report the exact published
40-character commit SHA. The Starter landing workflow owns `opencode:bump` and
the subsequent pin verification; do not edit its pin from this repository.
