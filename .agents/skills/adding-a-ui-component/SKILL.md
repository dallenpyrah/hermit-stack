---
name: adding-a-ui-component
description: Adds or changes a component in hermit-stack's design system, packages/ui, as a FoldKit view styled with StyleX tokens and covered by Scene tests. Use when asked for a new component, a variant, a token, a theme change, or any styling work in the shared UI. Not for docs-site styling under apps/docs.
---

# Adding a UI component

Components live in `packages/ui`, one folder each, and apps import them as `@repo/ui/<name>`. The walkthrough is `apps/docs/content/guides/add-a-component.md`.

## Read first

- `packages/ui/src/badge/badge.view.ts`: the whole pattern in one file (variant schema, `render`, the `Fn.dual` export, the `data-variant` attribute).
- `packages/ui/src/button/button.view.ts` when the component is interactive. It wraps a headless primitive from `@foldkit/ui`, which owns focus, keyboard handling and ARIA. Read that primitive's source in `node_modules` before wrapping one.
- `packages/ui/src/tokens/tokens.stylex.ts` for the tokens that exist.

## Rules

- Design the component from the tokens. Never open or copy from FoldCN.
- Every color, size, radius and duration is a token from `@repo/ui/tokens.stylex`. If a value is missing, add a token there. A color also needs its dark value in `packages/ui/src/theme/theme.view.ts`.
- Variants are a `Schema.Literals([...])` union, exported so a test can loop over every one.
- The exported function is dual, `name(options, html)` and `name(html)(options)`, with the arity in a named constant.
- No Tailwind and no class-name strings. StyleX `create` only.

## Steps

1. Write `packages/ui/src/<name>/<name>.view.ts`.
2. Add `"./<name>": "./src/<name>/<name>.view.ts"` to `exports` in `packages/ui/package.json`. There is no barrel file; `structure/barrel-imports` refuses one.
3. Write `packages/ui/tests/<name>/<name>.view.test.ts` as a Scene test. Assert what the component promises: its content, the `data-variant` of each variant, its role and accessible name, and whether it takes or refuses a click. Do not assert styles.
4. Add a sample to `packages/ui/gallery/samples.view.ts`.
5. Build the gallery and look at it (see Done).

## Gotchas

- A component that only shows something needs no primitive, but it still needs its role: an alert is `html.Role("alert")`.
- A folder holds at most 10 code files, so one component per folder.
- FoldKit roles (`model`, `message`, `update`, `subscription`, `command`) are on for `packages/ui`. A file that is only a view ends in `.view.ts`.

## Done

```bash
mise exec -- pnpm exec turbo run typecheck lint test build --filter=@repo/ui
```

It exits 0. `build` writes the gallery to the package's `dist/` folder. Open its `index.html`, take a screenshot in the light theme and in the dark theme, and inspect both: the component in each variant, and the focus ring, which must reach a contrast of 3:1. Passing tests do not show how it looks.
