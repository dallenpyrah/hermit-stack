# Rika Labs rules

The shared rulebook every Rika Labs repo extends: what a change must satisfy before the gate passes, and how each rule is checked.

## Language

**Gate**:
The one command whose pass means a change is acceptable.
_Avoid_: CI, pipeline, checks

**Rule**:
A check that fails the gate when code breaks it.
_Avoid_: lint, guideline, convention

**Deterministic rule**:
A rule that a type, an Oxlint rule or a script answers exactly and for free.
_Avoid_: static rule, hard rule

**Taste rule**:
A rule that encodes how a high-taste Effect codebase reads, such as named Effect functions or tagged errors.
_Avoid_: style rule, preference

**Role**:
The kind of thing a file holds, written as the part of its name before the extension, as in `room-log.service.ts`.
The `build` role and Foldkit's `command`, `message`, `model`, `subscription` and `update` roles and Alchemy Domain's twelve roles are opt-in: a config must list each one it uses in `structure/file-role`'s `roles` option.
_Avoid_: suffix, file type, kind

**Off table**:
The one list of rules that are turned off, each with its reason.
_Avoid_: exceptions, allowlist, disables

**Fixture**:
A labeled example a rule must get right: a violation, a clean case or a near-miss.
_Avoid_: sample, test case, example

**Near-miss**:
A clean fixture that looks like a violation.
_Avoid_: edge case, trick case

**False alarm**:
A clean fixture or clean code that a rule reports.
_Avoid_: false positive (in prose), noise
