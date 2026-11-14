---
title: "Design system"
description: "StyleX tokens and FoldKit components written from scratch, with light and dark themes."
status: built
---

`packages/ui` (`@repo/ui`) is hermit-stack's design system: typed tokens, two themes and a set of components every FoldKit app shares. It follows the shadcn model of three parts, with each part replaced by something that fits an Effect and StyleX stack:

| shadcn                               | hermit-stack                                            |
| ------------------------------------ | ------------------------------------------------------- |
| Radix headless primitives            | `@foldkit/ui` headless primitives                       |
| Tailwind theme variables             | StyleX `defineVars` tokens with the same semantic names |
| Components copied in from a registry | A workspace package you own and edit, `packages/ui`     |

The components are written here from the tokens. FoldCN is not used: not as a dependency, not as a source of code and not as a model for props.

## Tokens

`packages/ui/src/tokens/tokens.stylex.ts`, exported as `@repo/ui/tokens.stylex`, defines every value a component may use:

| Group                                          | Names                                                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `colors`                                       | shadcn's semantic names (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, each with its `Foreground` pair) plus `overlay` |
| `radius`                                       | `sm`, `md`, `lg`, `xl`, `full`                                                                                                                                                                               |
| `space`                                        | `none`, `xxs` to `xxxl`                                                                                                                                                                                      |
| `control`                                      | heights for controls                                                                                                                                                                                         |
| `font`, `fontSize`, `lineHeight`, `fontWeight` | type scale, with each line height paired to the font size of the same name                                                                                                                                   |
| `shadow`, `motion`                             | elevation and transition timing                                                                                                                                                                              |

`input` and `ring` are deliberately darker than shadcn's, so field borders and the focus ring reach a contrast of 3:1 against the background.

A component's styles name tokens, never raw values:

```ts
import { create } from "@stylexjs/stylex";

import { colors, radius, space } from "@repo/ui/tokens.stylex";

const styles = create({
  panel: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.lg,
    color: colors.cardForeground,
    padding: space.xl,
  },
});
```

## Themes

`packages/ui/src/theme/theme.view.ts` (`@repo/ui/theme`) defines a light and a dark theme with StyleX `createTheme`. `themeAttributes(name)` returns the attributes that apply a theme to an element's subtree: its variables, the page colors and `color-scheme`, so native scrollbars and form controls follow the theme too. A light region can sit inside a dark one.

## Components

Six components, each a FoldKit view over a `@foldkit/ui` primitive, styled only with StyleX:

| Component | Import            | Notes                                                                                                                                                                                   |
| --------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button    | `@repo/ui/button` | Variants `primary`, `secondary`, `destructive`, `outline`, `ghost`, `link`; sizes `sm`, `md`, `lg`. An icon-only button takes `iconOnly: { label }`, which becomes its accessible name. |
| Input     | `@repo/ui/input`  | A text field whose border uses the `input` token.                                                                                                                                       |
| Label     | `@repo/ui/label`  | Takes the `fieldId` it names, so clicking the label focuses the field.                                                                                                                  |
| Card      | `@repo/ui/card`   | A surface with a title, and optional description, action, body and footer.                                                                                                              |
| Badge     | `@repo/ui/badge`  | Text only, so it takes no handlers.                                                                                                                                                     |
| Dialog    | `@repo/ui/dialog` | A modal with a title, description, body, actions and an optional close button.                                                                                                          |

Every component is called as `name(options, html)`, and each has the pipeable form `name(html)(options)`:

```ts
import type { Html, HtmlBuilder } from "foldkit/html";

import { badge } from "@repo/ui/badge";
import { button } from "@repo/ui/button";

const toolbar = (html: HtmlBuilder<never>): Html =>
  html.div(
    [],
    [
      button({ content: ["Save"] }, html),
      button({ content: ["Cancel"], variant: "ghost" }, html),
      badge({ content: ["3 new"], variant: "secondary" }, html),
    ],
  );
```

## Building with it

Every app that renders these components compiles StyleX through one Vite plugin, `stylexPlugin()` from `@repo/ui/vite`. One plugin matters because a token's class name is a hash of the file that defines it, and two builds that resolved modules differently would disagree about the tokens.

The package has a gallery of every component in both themes. `vite build` in `packages/ui` writes it to the package's `dist/` folder as plain static files you can open in a browser.

<Note>
These docs are the one exception to "StyleX everywhere". They are a Next.js app with plain CSS, and their neutral colors are copied from these tokens so the docs and the product look related.
</Note>

## How to check it

```bash
mise exec -- pnpm exec turbo run test build --filter=@repo/ui
```

The package has 24 Scene tests: each renders a component in a small FoldKit program, with no browser, and checks what a person would see, such as its text, its variant and whether it takes clicks. [Add a component](/guides/add-a-component) shows how to write one.
