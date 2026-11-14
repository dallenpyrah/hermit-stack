# hermit-stack

A template monorepo to fork for new products. One Effect program: the domain model, the host that runs its actors, and the cloud are each supplied as a Layer, so a deploy target is a named composition of Layers.

Effect, FoldKit, Alchemy, Oxlint and StyleX always stay. Every vendor, host and cloud is swappable.

## Read first

- `node_modules/effect/AGENTS.md`: the Effect v4 idioms the lint rules encode.
- `tools/rules/docs/adr/`: why the rules are shaped the way they are.
- Read a dependency's source in `node_modules` before using its API. `pnpm agent-sources` also clones the source of each package in `agent-sources.json`, at its pinned version, into `.agent_sources/`. Effect v4, Alchemy 2 beta and FoldKit all changed recently, so do not write their APIs from memory.

## Commands

Run everything through mise so the pinned Node and pnpm are used.

- `mise exec -- pnpm install`
- `mise exec -- pnpm check`: boundaries, then format check, typecheck, lint, file roles, tests, build, knip, the ratchet, task inputs, doc paths, sherif, gitleaks, env reads, the check scripts and flag dates, in one Turbo run. Done means this exits 0. `tools/rules/AGENTS.md` describes each check.
- `mise exec -- pnpm check:affected`: the same tasks, limited to what changed on this branch.
- `mise exec -- pnpm fmt`: format with oxfmt.
- `mise exec -- pnpm exec turbo run test --filter=@repo/kernel`: one package's tests.

## Layout

```
apps/        things people open: docs (Next.js), cli (an example command line over the Api)
contexts/    one package per bounded context, written with @alchemy.run/domain: ledger, outbound
adapters/    one package per vendor; the only place its SDK is imported: otlp, axiom, better-auth
packages/    kernel (span names; depends on effect only), ui (design system), client-data (cached queries
             for FoldKit), flags, identity (who is signed in), telemetry, schedule, conformance
services/    api: where a host, a telemetry backend and the adapters are chosen
spec/        behaviour tests through the Api only; never imports a context's src
tools/rules/ the lint and type rules, copied from rika-labs/rules (see UPSTREAM.md)
.agents/     skills: step-by-step guides for the tasks below
```

Planned and not on `main` yet: `apps/web/**` (FoldKit), `apps/desktop/**`, `apps/panels/**` and `infra/**` (Alchemy stacks). The tags and globs for them already exist.

## Skills

Load the skill before starting one of these tasks. Each names the code to copy, the mistakes made before, and the check that proves the work.

- `.agents/skills/adding-a-context/SKILL.md`: a bounded context, or an aggregate, command, event or rejection in one.
- `.agents/skills/adding-an-adapter/SKILL.md`: a vendor behind a port, with its fake and contract suite.
- `.agents/skills/adding-a-ui-component/SKILL.md`: a component, variant or token in `packages/ui`.
- `.agents/skills/adding-a-feature-flag/SKILL.md`: declaring, reading, testing and removing a flag.
- `.agents/skills/fixing-a-failing-check/SKILL.md`: what each failing `pnpm check` task asks for.

## Dependency direction

Turbo `boundaries` tags in each package's `turbo.json` enforce this. Tags: `kernel`, `lib`, `context`, `adapter`, `service`, `infra`, `app`, `spec`, `tooling`. Nothing may depend on an `app` or on `spec`.

```
apps      ──▶ contexts, packages
services  ──▶ contexts, adapters, packages
infra     ──▶ services
adapters  ──▶ contexts (the port it implements), packages/kernel
contexts  ──▶ packages/kernel and other lib packages
kernel    ──▶ effect only
```

- A context never imports a service, an adapter, infra, an app or a host package.
- Only `adapters/*` imports a vendor SDK. A context declares a port (an Effect service); an adapter implements it as a Layer.

## Conventions the checks enforce

Files:

- Name every file `<kebab-name>.<role>.ts`, such as `span-name.pure.ts`. The role list is in `tools/rules/src/oxlint/structure/roles.pure.ts`.
- Alchemy Domain roles (`aggregate`, `command`, `event`, `projection`, `policy`, `saga` and the rest) are enabled under `contexts/**` and `packages/schedule/**`. FoldKit roles (`model`, `message`, `update`, `subscription`, `command`) are enabled under `apps/web/**`, `apps/panels/**`, `packages/ui/**` and `packages/client-data/**`. `oxlint-structure.config.ts` lists both.
- Tests live in `tests/`, mirroring `src/`: `src/telemetry/span-name.pure.ts` is tested by `tests/telemetry/span-name.pure.test.ts`.
- A fake lives in `tests/` too, at the path and name of the `src/` file it stands in for: `src/notification/email.external.ts` has `tests/notification/email.fake.ts`. A package may export it for another package's tests. An in-memory implementation that a running target uses is not a fake: it is a `layer` in `src/`.
- At most 10 code files directly in one folder, and at most 500 lines in a file.
- A feature flag is declared in a `<name>.flag.ts` file with `Flag.release` or `Flag.ops` from `@repo/flags/flag`, and read with `Flags.get`. `pnpm check` fails once a flag passes its `removeBy` or `reviewBy` date.

Imports:

- Import a package's own source as `#src/<path>/<name>.<role>.js`. Relative imports also end in `.js`.
- Internal packages are named `@repo/<name>` and are consumed as source: `exports` points at `src/*.ts`, with no build step.

Code:

- An exported function with two or more parameters has a pipeable form: `Fn.dual(arity, ...)`, with the arity in a named constant.
- No inline rule suppressions. A rule is turned off only in the off table in `tools/rules/src/oxlint/base.config.ts`, with a reason.
- No comments in `.ts`, `.tsx`, `.js` or `.mjs` files (`structure/no-comments`). Put what a comment would say into a name, a type or a test, and the reason for a design into the docs page that covers it. Four lines a tool reads stay: a `#!` first line, `/// <reference ... />`, the `// SAFETY: <reason>` line a type assertion needs, and `/** @stability unstable */` alone on its line, which marks an export built on an unstable Effect API. Code blocks in Markdown follow the same rule.

Domain code (`contexts/**` and `packages/schedule/**`):

- One class per file. Copy `contexts/ledger/src/account/`.
- Each use case has its own folder beside its aggregate, such as `contexts/ledger/src/account/deposit/`. It holds the command, the events that command records, its rejections, and the policy that sends the command, if one does.
- The command file also holds the command's rule, exported as `decide<Command>`. The aggregate file lists the commands and holds how events change the state.
- The aggregate's state is in `<aggregate>-state.schema.ts` beside the aggregate, so every command file can read it.
- A command's `input` lists its own fields. An event's `.fields` include the event's tag, so do not reuse them as an input.
- Tests mirror the folders: `contexts/ledger/tests/account/deposit/deposit-money.command.test.ts`. Steps that several stories share go in a `.suite.ts` under `tests/`, exported `as const satisfies readonly Step[]`. A suite does not import another suite.
- An `.aggregate.ts` or `.model.ts` file may import 20 modules, because it lists one class per file. Every other file keeps the cap of 10.

Tests:

- `import { describe, expect, it } from "@effect/vitest"`. Each case is a named function run with `it.effect("...", () => Effect.sync(fn))`, or an `Effect.fn`.
- A `describe` title is a phrase, not the name of an imported function.
- Never call `Effect.run*` in a test.

Packages:

- No version in a `package.json`. Add the version to the catalog in `pnpm-workspace.yaml` and write `catalog:`.
- A package with tests lists `vite`, `vitest` and `@effect/vitest` in `devDependencies`, because peers are not installed automatically.
- Copy `packages/kernel` for a new package: its `package.json` scripts, `tsconfig.json`, `vitest.config.ts` and `turbo.json` (set the tag).
- A new release must be a day old before it installs (`minimumReleaseAge`). Pick the newest version that passes, and do not weaken the policy.

## Do not

- Do not push, publish or deploy unless Dallen asks for it in that turn.
- Do not use FoldCN or copy from it. Components in `packages/ui` are designed from the tokens.
- Do not skip hooks with `--no-verify`.
- Do not import a vendor SDK outside `adapters/*`.
- Do not hand-write a shape the domain model already derives (API, client, storage).
- Do not import the rules from `@rikalabs/rules`. They are copied into `tools/rules` as `@repo/rules`.
- Do not report a result you did not measure.
