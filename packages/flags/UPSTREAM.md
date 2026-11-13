# Upstream

Parts of this package are adapted from rat-stack (`<rat-stack>/packages/flags` and `<rat-stack>/packages/core/src/flags.ts`), which is MIT
licensed:

> MIT License
>
> Copyright (c) 2026 Joel Hooks
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
> documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
> rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
> persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
> Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
> WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
> COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
> OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## What was taken

| Here                                   | From rat-stack                                                                                                | Changes                                                                                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/flag/flag.pure.ts`                | `defineFlag(name, schema, { default, owner, purpose, removeBy })` in `<rat-stack>/packages/core/src/flags.ts` | Split into `Flag.release` (with `removeBy`) and `Flag.ops` (with `reviewBy`). Rungs, read scopes, kill policy and the failure policy are dropped. Nothing is validated at import time; `flags:check` validates instead. |
| `src/evaluate/evaluate.pure.ts`        | `evaluateFlag` in `<rat-stack>/packages/flags/src/evaluate.ts`                                                | Same rules (subject list or percentage, first match wins). A rule with neither condition now matches everyone, which is how a store holds a plain value.                                                                |
| `src/evaluate/bucket.pure.ts`          | `subjectBucket` in `<rat-stack>/packages/flags/src/evaluate.ts`                                               | Still FNV-1a over code points, but over `<name>\0<subject>` instead of a JSON array, with MurmurHash3's fmix32 finaliser added, so buckets differ from rat-stack's.                                                     |
| `src/store/flag-store.service.ts`      | `configFlagsLayer` in `<rat-stack>/packages/flags/src/config.ts`                                              | Read per flag through a `FlagStore` port, under `FLAG_<NAME>` instead of the bare flag name.                                                                                                                            |
| `tests/store/flag-store.fake.ts`       | `memoryFlagsLayer` in `<rat-stack>/packages/flags/src/memory.ts`                                              | Only the rules snapshot; no flag ledger, journal or positions.                                                                                                                                                          |
| `src/check/flag-check.pure.ts`         | `checkFlagExpiry` in `<rat-stack>/packages/flags/src/expiry.ts`                                               | Checks `reviewBy` as well as `removeBy`, finds flags by loading every `*.flag.ts` instead of a hand-kept registry, and reports a definition it cannot read.                                                             |
| `tests/evaluate/evaluate.pure.test.ts` | `<rat-stack>/packages/flags/test/evaluate.test.ts`                                                            | The determinism and stickiness properties.                                                                                                                                                                              |

Not taken: the XState lifecycle (`lifecycle.ts`), the Cloudflare KV store (`kv.ts`, `cloudflare*.ts`), the remote
store, the projection and the flag capabilities.
