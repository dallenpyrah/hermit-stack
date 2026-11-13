---
status: accepted
date: 2026-11-05
---

# anti-slop is vendored

`dmmulroy/anti-slop` (18 core and 5 Effect rules) is not on npm, which has only a 0.0.0 placeholder, so its source is vendored at upstream commit 13909c9 under `src/oxlint/anti-slop`, with its MIT license and the license of the eslint-stylistic code it vendors. Its rules sit in domain folders and its tests in the `tests/oxlint/anti-slop/` mirror, and `src/oxlint/anti-slop/UPSTREAM.md` maps each upstream path to its place here. Updating means copying a newer upstream commit and rerunning its tests.
