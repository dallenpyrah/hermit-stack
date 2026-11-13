---
status: accepted
date: 2026-11-05
---

# Every Oxlint category is at error, and exceptions are data

Every Oxlint category (correctness, suspicious, pedantic, perf, style, restriction, nursery) runs at error, which covers all 111 recommended rules, together with anti-slop and the taste plugin. A rule is off only in the off table in `src/oxlint/base.config.ts`, with its reason. Inline `oxlint-disable`, `@ts-expect-error` and `@ts-ignore` are not allowed. Where two rules contradict, the table records which one we kept and why.
