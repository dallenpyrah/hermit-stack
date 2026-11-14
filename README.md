# hermit-stack 🐚

_Same crab, new shell._

A template monorepo to fork for new products. It is one Effect program: the domain model, the host that runs its actors, and the cloud are each supplied as a Layer. Moving to another host, cloud or vendor changes the shell and leaves the crab alone.

## The crab and the shell

A hermit crab keeps its body and moves into a new shell when the old one stops fitting.

| The crab: always stays | The shell: swap it                                       |
| ---------------------- | -------------------------------------------------------- |
| Effect                 | Actor host: in-memory, Rivet, Cloudflare Durable Objects |
| FoldKit                | Cloud: GCP, AWS, Cloudflare                              |
| Alchemy                | Telemetry backend                                        |
| StyleX                 | Vendors: auth, billing, storage, mail                    |
| Oxlint                 |                                                          |

The crab stays in this README. In code and in the docs the words are `target`, `host` and `adapter`.

## Shells

A shell is a target: one host, one cloud and the adapters for it, picked by one config value.

| Shell        | Host                       | Status  |
| ------------ | -------------------------- | ------- |
| `local`      | in-memory                  | passing |
| `cloudflare` | Cloudflare Durable Objects | planned |
| `gcp`        | Rivet                      | planned |
| `aws`        | Rivet                      | planned |

A shell is `passing` when the conformance suite, the same tests run unchanged against every shell, passes against it. `spec/` runs it against `local` on every `pnpm check`.

## Start

```sh
mise install
mise exec -- pnpm install
mise exec -- pnpm check
```

`pnpm check` is the one command that says whether the repo is sound. [AGENTS.md](./AGENTS.md) lists the layout, the dependency rules and the conventions the checks enforce.

## What the checks hold you to

- **One program.** Frontend, backend, infrastructure and tests are Effect, with typed errors and dependencies in the type.
- **Every choice is a Layer.** A vendor, host, cloud or telemetry backend is one `Layer.provide` line, and only `adapters/*` imports a vendor SDK.
- **The domain is the source of truth.** The API, the client and the storage derive from the model in `contexts/`.
- **Every file names its role.** `open-account.command.ts`, `account.aggregate.ts`, with `tests/` mirroring `src/`.
- **Every rule is an error.** No warnings and no inline suppressions.
- **Tests judge from outside.** `spec/` reaches the system only through its API, so the tests survive a rewrite of what is behind it.

## Lineage

The lint and type rules in `tools/rules` are a copy of `rika-labs/rules`; [UPSTREAM.md](./tools/rules/UPSTREAM.md) records the commit. The docs site's shell is adapted from `rika-labs/akter`; [its UPSTREAM.md](./apps/docs/UPSTREAM.md) lists each file.

## License

[MIT](./LICENSE)
