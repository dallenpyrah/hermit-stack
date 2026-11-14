# Mutants

`mutant-cafe` (pinned in the root catalog) breaks one function at a time in ways that still type-check, runs the tests that import it, and records each mutant's outcome in `mutants.out/outcomes.json`. `src/mutants/mutants.cli.mjs` (`mutants`) turns that report into a pass or a fail.

## What fails

- A failed or timed-out baseline. A mutant counts only against tests that pass.
- A mutant that is `missed`, `untested`, `timeout` or `unreliable` and is not listed in the package's `mutants.equivalent.json` or `mutants.baseline.json`.
- An entry in `mutants.equivalent.json` with an empty reason.
- A baseline entry absent from a fresh complete `mutant-cafe --list --format json` enumeration, even in a diff run. Enumeration does not run tests; a failed or malformed enumeration fails the check.
- An entry in either list whose mutant the run now catches or finds unviable, and with `--all` an entry whose mutant the run no longer generates. A stale entry would hide the next mutant that reuses its id.

A mutant id comes from its file path and code under one `mutant-cafe` version, so moving a file, editing a mutated function or bumping the version needs a full run and refreshed lists in the same commit.

## Equivalent mutants

An entry says why no test can tell the mutant from the original, for example that the replacement returns the same value the body already returns:

```json
{
  "95010e587b669464474e6117": {
    "at": "src/host/actor-layout.sql.ts:34:42",
    "mutant": "replace storedLayoutVersion.onEmpty with Effect.succeed(Option.none())",
    "reason": "The body is Effect.succeedNone, the same value."
  }
}
```

Each failure prints the entry for its mutant with an empty reason. Prefer a test that kills the mutant. `ratchet` counts the entries as `equivalent mutants`, so a new one needs the matching `ratchets.json` change.

## Survivor baseline

`mutants.baseline.json` holds the survivors a package had when the check arrived and has not killed yet, with no reason, so a new survivor fails at once while the old ones are worked off. `pnpm exec mutants --write-baseline` writes it from the last run, leaving out equivalent mutants. `ratchet` counts its entries as `baseline surviving mutants`, and the stale-entry rule makes the file shrink as tests kill them. Delete it when it is empty.

The writer refuses every report failure without changing an existing baseline or creating a new one. A non-empty run with no non-equivalent survivors also refuses unless `--allow-empty-baseline` is explicitly passed with `--write-baseline`; that flag never overrides a failed run. Successful writes flush a new file in a unique sibling directory and rename it over the baseline, so interruption before publication leaves the old baseline intact. Ordinary write or rename failures clean up the staging directory; a killed process can leave that directory for removal, but never publishes its partial file.

## In hermit-stack

The freshness check uses the root's pinned `mutant-cafe@0.1.6` peer binary on `PATH`. Packages without a survivor baseline skip enumeration.

The root `pnpm-workspace.yaml` permits exactly `mutant-cafe@0.1.6` under pnpm's `trustPolicyExclude`, with its release-workflow/SLSA rationale, because npm's trusted-publisher metadata stops at 0.1.2; `trustPolicy` stays `no-downgrade`. The exception is counted in `ratchets.json`; upgrade and remove it when a release restores provenance.

A package that adopts mutation testing adds `mutants` and `mutants:diff` scripts: `pnpm mutants` runs every mutant in the package's `mutants.config.json` scope and then `mutants --all`. `pnpm mutants:diff` runs only the mutants on lines changed since `main` (`--in-diff-range main...HEAD`) and then `mutants`. A baseline id outside the selected diff stays valid only when complete enumeration still generates it; an absent id fails in either mode.

`packages/kernel`, `contexts/ledger`, `packages/schedule` and `contexts/outbound` run it. The root `turbo.json` defines the `mutants` and `mutants:diff` tasks, and the root `pnpm mutants` and `pnpm mutants:diff` run them in every package that has the script. Neither is in `pnpm check`. A diff run of a one-line change took 29 s for the package it touched and 7 to 11 s for each package it did not, on a quiet machine, and grows with every mutant a change selects and every package that adopts it; it also needs a local `main` branch, which a pull request checkout does not have. The nightly job in `.github/workflows/check.yml` runs the full `pnpm mutants`; run `pnpm mutants:diff` yourself before you push.

### Adopting it in a package

1. Copy `mutants.config.json` from `contexts/ledger`: `include` is `src/**/*.ts`, and `jobs` is how many scratch copies run at once.
2. Copy the `mutants` and `mutants:diff` scripts from its `package.json`. `mutant-cafe` and `mutants` come from the root's `node_modules/.bin`, so the package adds no dependency, and the root tasks pick it up without a change to the root `turbo.json`.
3. Run `pnpm mutants` in the package. For each survivor, write a test through the package's public behaviour that fails on it: a Story for a context, the exported function for a pure file. A function passed straight to `Fn.dual` is in callback position and is not mutated, so name it first, as `packages/kernel/src/telemetry/span-name.pure.ts` does, when it holds logic no other function covers.
4. List a survivor in `mutants.equivalent.json` only when no test could tell it from the original, with the reason. Leave one in `mutants.baseline.json` (`mutants --write-baseline`) only when it cannot be killed yet, and say why in the commit.
5. Set the `equivalent mutants` and `baseline surviving mutants` counts with `pnpm exec ratchet --print`.
