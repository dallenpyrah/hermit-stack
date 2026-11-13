# Strata

A template monorepo to fork for new products. One Effect program: the domain model, the host that runs its actors, and the cloud are each supplied as a Layer, so a deploy target is a named composition of Layers.

Effect, FoldKit, Alchemy, Oxlint and StyleX always stay. Every vendor, host and cloud is swappable.

## Read first

- `node_modules/effect/AGENTS.md`: the Effect v4 idioms the lint rules encode.
- `tools/rules/docs/adr/`: why the rules are shaped the way they are.
- Read a dependency's source in `node_modules` before using its API. `pnpm agent-sources` also clones the source of each package in `agent-sources.json`, at its pinned version, into `.agent_sources/`. Effect v4, Alchemy 2 beta and FoldKit all changed recently, so do not write their APIs from memory.

## Commands

Run everything through mise so the pinned Node and pnpm are used.

- `mise exec -- pnpm install`
- `mise exec -- pnpm check`: boundaries, then format check, typecheck, lint, file roles, tests, build, knip, the ratchet, task inputs, doc paths, sherif, gitleaks, env reads and the check scripts, in one Turbo run. Done means this exits 0. `tools/rules/AGENTS.md` describes each check.
- `mise exec -- pnpm check:affected`: the same tasks, limited to what changed on this branch.
- `mise exec -- pnpm fmt`: format with oxfmt.
- `mise exec -- pnpm exec turbo run test --filter=@repo/kernel`: one package's tests.

## Layout

```
apps/        things people open: web (FoldKit), docs (Fumadocs), cli, desktop, panels
contexts/    one package per bounded context, written with @alchemy.run/domain
adapters/    one package per vendor; the only place its SDK is imported
packages/    kernel (shared ids, errors, span names), ui, flags, schedule, conformance
services/    api: where a host, a telemetry backend and the adapters are chosen
infra/       Alchemy stacks
spec/        behaviour tests through the Api only; never imports a context's src
tools/rules/ the lint and type rules, copied from rika-labs/rules (see UPSTREAM.md)
```

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

Imports:

- Import a package's own source as `#src/<path>/<name>.<role>.js`. Relative imports also end in `.js`.
- Internal packages are named `@repo/<name>` and are consumed as source: `exports` points at `src/*.ts`, with no build step.

Code:

- An exported function with two or more parameters has a pipeable form: `Fn.dual(arity, ...)`, with the arity in a named constant.
- No inline rule suppressions. A rule is turned off only in the off table in `tools/rules/src/oxlint/base.config.ts`, with a reason.
- Comments start with a capital letter and say why, not what.

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

- Do not push, publish, deploy or add a git remote. Everything stays local until Dallen says otherwise.
- Do not skip hooks with `--no-verify`.
- Do not import a vendor SDK outside `adapters/*`.
- Do not hand-write a shape the domain model already derives (API, client, storage).
- Do not import the rules from `@rikalabs/rules`. They are copied into `tools/rules` as `@repo/rules`.
- Do not report a result you did not measure.
