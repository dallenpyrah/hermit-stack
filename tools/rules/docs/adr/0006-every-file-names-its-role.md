# Every file names its role

Status: accepted, 2026-11-07

## Decision

Every source file is named `<kebab-name>.<role>.<ext>`, as in `room-log.service.ts` or `ratchet.cli.mjs`. The folder names the concept, the name names the thing, and the role names what kind of file it is and therefore what it may hold and import. The roles live in one list, `src/oxlint/structure/roles.pure.ts`, which the lint rules read. The only file without a role is an `index.ts` directly in a package's `src`, and it may only re-export.

Deterministic rules, in the `structure` plugin, run over every file in a repo through `lint:structure`:

- `file-role`: the name has a kebab name, a known role and a source extension. An opt-in role is known only where the config lists it in the rule's `roles` option, directly or through a preset.
- `role-exports`: tests, entry points and benchmarks export nothing; a TypeScript `.service` or `.adapter` exports exactly one `Context.Service` class and no other values; an `.errors` file exports only tagged errors; definitions, pure files, layers, build files and Foldkit modules define no service; a `.rule` file exports one rule; an `index.ts` only re-exports.
- `role-imports`: definitions import only definitions, pure files only pure files and definitions, services no I/O packages, and nothing imports a test, main, CLI or benchmark. Fakes are reachable only from tests, suites, benchmarks and layers, and a `.build` file only from build, config and test files (and framework entry files, which have no role). Type-only imports are always allowed, and a dynamic `import()` is checked like a static one. Each repo lists the packages its logic may import (`packages` option). A whole-scope entry such as `@akter-cloud/` also needs an `exports` map, which `roleImports` from `@rikalabs/rules/oxlint/role-imports` builds from the workspace's package.json `exports` when the config loads, so a pure or contract file reaches a scoped module only when the map points it at a role it may import. A repo can list a scoped entry in `definitionServices` when its definitions must import a `.service` through it, as akter's contracts import `@akterjs/effect/contract` (the `Akter` service, DAL-361); the ratchet counts each one.

## Build-time framework modules

`.build` is for code a framework runs only while it builds the app, such as Next.js and Fumadocs config helpers, remark plugins and file readers, with no Effect runtime (DAL-181). It is opt-in: `nextStructure({ appFiles })` turns it on through the `roles` option for a Next.js app's files, and anywhere else `file-role` rejects it unless the config lists `build`. Before it, the docs port named these files `.adapter` with a preset option that let adapters export plain functions, or `.config`. Code that runs with the app cannot import a `.build` file, so a value a view needs is computed in a framework entry file and passed in.

## Foldkit modules

Foldkit modules have five opt-in roles (INT-396). Each is rejected unless the config lists it in `structure/file-role`'s `roles` option: `["command", "message", "model", "subscription", "update"]`. Consumers configure the options directly; there is no Foldkit preset, and repos that do not opt in gain no new file names.

| Role            | What it holds                                             | May import, besides definitions                               |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| `.model`        | The Model schema and its types                            | model, pure                                                   |
| `.message`      | The Message union                                         | message, model, pure                                          |
| `.update`       | The pure `(model, message) -> [model, commands]` function | command, message, model, pure, update                         |
| `.command`      | Command definitions                                       | adapter, command, message, model, pure, service               |
| `.subscription` | Subscription definitions                                  | adapter, command, message, model, pure, subscription, service |

Definitions here are api, contract, errors and schema. Only command and subscription among the Foldkit roles may reach services and adapters. None of the five defines a service; `.view` stays unrestricted by this import-edge table. Type-only imports remain allowed.

Consumers must also list `"foldkit"` in `structure/role-imports`'s `packages` option, alongside any other pure logic packages they use. An exact package entry allows its subpaths too; `effect` is already allowed. Opting into file names does not allow packages.

## Alchemy Domain modules

An Alchemy Domain model package (`@alchemy.run/domain`) has twelve opt-in roles, named after Domain's own building blocks. `domainStructure({ files, packages })` from `@rikalabs/rules/oxlint/domain` enables them with `command` and `model` for the given files, allows `@alchemy.run/domain` plus `packages`, and gives `command`, `model`, `view` and `api` their Domain edges through `structure/role-imports`'s `edges` option, which replaces a role's default edges only for those files. A repo can use Foldkit roles in its web packages and Domain roles in its model packages; a package is one or the other.

| Role          | What it holds                                   | May import                                                                           |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `.id`         | An aggregate's branded id                       | definitions, id, pure                                                                |
| `.rejection`  | `Domain.Rejection`                              | definitions, id, pure                                                                |
| `.event`      | `Domain.Event` emitted by more than one command | definitions, id, pure                                                                |
| `.context`    | `Domain.RequestContext`                         | definitions, context, id, rejection                                                  |
| `.middleware` | An Api middleware declaration                   | definitions, context, id, rejection                                                  |
| `.command`    | `Domain.Command` and the events only it emits   | context, event, id, middleware, pure, rejection, schema                              |
| `.aggregate`  | `Domain.Aggregate`                              | command, event, id, pure, rejection, schema                                          |
| `.view`       | `Domain.View`                                   | aggregate, command, context, event, id, middleware, pure, rejection, schema, service |
| `.projection` | `Domain.Projection`                             | aggregate, command, event, id, pure, schema, service                                 |
| `.stream`     | `Domain.Stream`                                 | aggregate, command, event, id, pure, schema, service                                 |
| `.query`      | `Domain.Query`                                  | id, projection, schema, service                                                      |
| `.policy`     | `Domain.Policy`, deadline policies included     | aggregate, command, event, external, id, pure, saga, schema                          |
| `.saga`       | `Domain.Saga`                                   | aggregate, command, event, external, id, pure, schema                                |
| `.external`   | `Domain.ExternalSystem`                         | errors, id, rejection, schema                                                        |
| `.api`        | `Domain.Api`                                    | command, context, middleware, model, query, stream, view                             |
| `.model`      | `Domain.Model`, one per bounded context         | every Domain role, api, command, pure, schema, view                                  |

Definitions here are api, contract, errors and schema. An event one command emits lives in that command's file, as Domain's examples do, so a role that reads events may import `.command`; views, projections, streams, policies and sagas name the aggregate they read, and a policy may start a saga. A view that guards its reads declares middleware and rejections and reads the request context in its validate Layer, and an Api names its model, as Domain's examples do. The `.service` a view, projection, stream or query imports is its store port. None of the twelve defines a service. The names follow Domain's kinds in Rika's form, `delivery.aggregate.ts` rather than Domain's `Delivery.aggregate.ts`, so one rule names every file.

## Exempt

Vendored code (`src/oxlint/anti-slop` and its tests in `tests/oxlint/anti-slop`), test fixtures, `dist` and `node_modules`. `.gen` files are skipped by lint and the 500-line cap.

## Consequences

- An Effect service key derived from the path includes the role, as in `@akterjs/effect/host/room-log.service/RoomLog` (`deterministicKeys`).
- Package exports point straight at role files, so a public subpath such as `@akterjs/effect/contract/room` no longer matches its file name.
- A file that does two things fails when the two things are visible in its exports.
- This replaces the "no role suffixes" rule proposed in the old working plan, akter-decisions.md, which is no longer kept, which never shipped.
