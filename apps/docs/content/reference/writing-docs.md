---
title: "Writing these docs"
description: "How this site is built, how pages are marked Built or Planned, and how code blocks and links are checked."
status: built
---

This site is `apps/docs`: Next.js with `fumadocs-core` and `fumadocs-mdx`, built as a static export. It is the only React app in the repo, its styles are plain CSS, and nothing may depend on it. The shell (sidebar, search, page layout) is adapted from Rika Labs' Akter docs; `apps/docs/UPSTREAM.md` lists what was taken and what changed.

## Add a page

1. Write a Markdown file under `apps/docs/content/`, such as `content/guides/my-guide.md`. Its path is its address: `/guides/my-guide`.
2. Give it front matter with a `title`, a one-sentence `description` and a `status`:

   ```yaml
   ---
   title: "My guide"
   description: "What the reader can do after reading it, in one sentence."
   status: built
   ---
   ```

3. Add its slug to a group in `apps/docs/src/content/navigation/navigation.pure.ts`, and give it an icon in `page-icons.pure.ts` beside it. A page that is not in the navigation is not built, and a page in the navigation without a file fails the build.
4. Preview it with `mise exec -- pnpm --filter @repo/docs run dev`.

The description is used everywhere a page is summarised: the Welcome cards, search results, `llms.txt` and the page's metadata.

## Built and Planned

Every page is one of two kinds, set by `status`:

- **`built`**: the thing is on `main`. Describe what it does and how to check it, with `ts` examples that pass the fence check below.
- **`planned`**: the thing is decided but not on `main`. Describe the design, how it fits, and what will prove it works. The sidebar shows a Planned badge, and the page opens with a callout saying so. Put no API that does not exist in a `ts` block: write sketches in `text` blocks and label them as sketches.

When a planned part merges, change its `status`, replace its sketches with real examples and run the check.

## Callouts

A paragraph wrapped in `<Note>`, `<Tip>`, `<Check>` or `<Warning>` on its own lines becomes a callout:

```text
<Tip>
On a branch, pnpm check:affected runs only what the branch changed.
</Tip>
```

## Code blocks are typechecked

Every block tagged `ts` or `typescript` is typechecked in `pnpm check`, so an example cannot go stale without the check failing. The `typecheck` task does it in two steps:

1. `apps/docs/src/fences/code-fences.cli.ts` writes each block to `.fences/<page>/line-<n>.ts`, where `n` is the page line the code starts on.
2. `effect-tsgo` typechecks those files with `apps/docs/tsconfig.fences.json`, which uses the repo's base config, so examples meet every Effect diagnostic the rest of the repo does.

Each block is its own module and states its own imports. It may import anything `apps/docs` lists in its `package.json`. To use another workspace package in an example, add it to the docs' `devDependencies` and to the `docExamples` list in the root `knip.config.ts`, because knip does not read the generated `.fences` folder.

Each written file keeps the page's line numbers, so an error points at the page:

```text
.fences/concepts/layers-and-ports/line-62.ts(79,30): error TS377032: Effect.provide with a Layer should only be used at application entry points.
```

Two diagnostics shape how examples are written. An exported Effect whose error type comes from an unstable module fails `apiStabilityLeak`, so examples keep their Effects unexported. And `Effect.provide` belongs at an entry point, so an example provides a Layer with `it.layer(...)` in a test.

To show code that is not checked, such as a shell command, a sketch or an excerpt that imports a package's private source, tag it `bash`, `json`, `yaml` or `text`.

## Links are checked

Write a link to another page as its address, such as `[Testing](/guides/testing#scene-tests)`, or to a file in the repo as a relative path from the Markdown file. The build fails on a link to a page that is not published, on an anchor that is not a heading of its page, and on a relative path that does not exist; a repository path becomes a link to the file on GitHub.

Separately, `lint:paths` in `pnpm check` fails on a path written in backticks that does not exist, in any tracked Markdown file, these pages included. Write a planned folder as a glob, such as `apps/web/**`, or with a placeholder, such as `contexts/<name>/`.

## What the build writes

`next build` writes the static site to the app's `out/` folder, and `src/export/finish-export.cli.ts` then checks the export is complete:

- an HTML page and a Markdown twin (`<slug>.md`) for every page;
- `llms.txt`, an index of every page for language models, and `llms-full.txt`, every page in one file;
- `search.json` and `search-sections.json`, the search index the browser downloads, so search needs no server;
- `sitemap.xml`, `robots.txt`, `404.html` and the favicon.

The site address used in those files is one value, `siteUrl` in `src/content/site/site.pure.ts`, and the repository behind "Edit this page" is `repositoryUrl` beside it.

## How to check it

```bash
mise exec -- pnpm exec turbo run typecheck lint build --filter=@repo/docs
```
