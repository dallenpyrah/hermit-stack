---
name: adding-an-adapter
description: Adds or swaps a vendor in hermit-stack behind a port, with a fake and a contract suite. Use when asked to integrate a third-party service or SDK (email, payments, auth, storage, telemetry, a queue), to replace one vendor with another, or to add a deploy host or cloud. Not for business rules (adding-a-context).
---

# Adding an adapter

A vendor is reached through a port. The port is an Effect service that names no vendor; the adapter is a package under `adapters/` that implements it as a Layer; one contract suite runs against the fake and against every adapter. Swapping a vendor then changes one package and one line of composition.

## Read first

- `packages/identity` and `adapters/better-auth`: a port, its fake, its contract suite, and an adapter that passes the suite. `adapters/better-auth/tests/local.layer.test.ts` shows the whole wiring in one file.
- `packages/telemetry`, `adapters/otlp` and `adapters/axiom`: one port with two adapters.
- The vendor package's source in `node_modules` before calling it. Do not write its API from memory.

## Where each piece goes

- The port: a `.service.ts` or `.external.ts` file in the context or `packages/*` package that uses it. It lists the operations the product needs and their typed failures, not the vendor's API. Leave out what only one vendor offers.
- The fake: `tests/<same path and name>.fake.ts` in the port's package, exported from its `package.json` so adapter tests can import it. It keeps state in memory and refuses what a real vendor refuses.
- The contract suite: a `.suite.ts` under `tests/` in the port's package, exported from its `package.json`. Every case goes through the port only.
- The adapter: `adapters/<vendor>/src/<name>.layer.ts`, tagged `adapter` in its `turbo.json`. Copy `adapters/otlp` for the package shell.

## Steps

1. Write the port and the contract suite, and make the suite pass against the fake.
2. Break the fake on purpose, once per case, and check that the suite fails. A suite that a careless adapter passes proves nothing.
3. Write the adapter Layer. Translate each vendor error into one of the port's typed failures.
4. Run the same suite against the adapter. Start a local stand-in for the vendor on a port the OS assigns (`testing/no-fixed-port` fails a fixed one), or a real local engine such as `node:sqlite`.
5. Declare every `Config` name the adapter reads in `.env.schema`, with `@sensitive` on a secret, and read a secret with `Config.Redacted`.
6. Provide the Layer where the target is composed, in `services/api`.

## Gotchas

- Import the vendor's package only inside `adapters/<vendor>/`. For the raw SDKs listed in `tools/rules/src/oxlint/structure/vendor-sdks.pure.ts` (Stripe, Resend, AWS, Cloudflare and others), `structure/vendor-imports` fails the import everywhere and names the `@distilled.cloud/*` or `@alchemy.run/*` package to use instead.
- Add the version to the catalog in `pnpm-workspace.yaml` and write `catalog:` in `package.json`. A release less than a day old does not install (`minimumReleaseAge`); pick the newest one that does, and do not weaken the policy.
- Effect marks many modules unstable (`effect/http`, `effect/rpc`, `effect/observability`, `@effect/vitest`). Each one the package uses goes in `allowedUnstableApis` in its `tsconfig.json`, and the ratchet counts them: run `mise exec -- pnpm exec ratchet --print` and add the new lines to `ratchets.json`, with the reason in the commit message.
- An export whose type includes an unstable Effect type needs `/** @stability unstable */` alone on the line above it. It is one of the four comments the no-comments rule allows. Importers then list that export in their own `allowedUnstableApis`.
- A service's shape must not carry a vendor type or the vendor's requirements. If the vendor's value needs a runtime context, resolve it inside the Layer, as `adapters/better-auth/src/auth.layer.ts` does.
- An adapter imports the package whose port it implements and `@repo/kernel`. `turbo boundaries` fails an adapter that imports a service or an app, and a context or `lib` package that imports an adapter.
- A stand-in proves the adapter against your reading of the vendor, not against the vendor. In the report, say which calls ran against the real service and which did not.

## Done

```bash
mise exec -- pnpm exec turbo run typecheck lint test --filter=@repo/<vendor> --filter=@repo/<port-package>
mise exec -- pnpm check
```

Both exit 0, and the contract suite ran against both the fake and the adapter.
