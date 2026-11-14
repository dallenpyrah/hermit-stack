---
title: "Add a component"
description: "Write a new FoldKit view in packages/ui, styled with StyleX tokens and covered by Scene tests."
status: built
---

Components live in `packages/ui`, one folder per component, and every app imports them from `@repo/ui/<name>`. This guide adds an `alert` component the way the six existing ones are built. Read [Design system](/concepts/design-system) first.

## 1. Pick the primitive

Interactive components wrap a headless primitive from `@foldkit/ui`, which owns focus, keyboard handling and ARIA. The button wraps `@foldkit/ui/button` and the dialog wraps its dialog. A component that only shows something, like a badge or an alert, needs no primitive.

## 2. Write the view

Create `packages/ui/src/<name>/<name>.view.ts`. The shape every component follows:

- **Options are a readonly object type**, with `content` for what it shows and optional `variant`, `size` and `style`.
- **Styles come only from tokens.** `create` from StyleX, with values from `@repo/ui/tokens.stylex`. No raw colors, sizes or durations.
- **Variants are a Schema literal union**, such as `Schema.Literals(["default", "destructive"])`, exported so tests can loop over every variant.
- **The function is dual**: `alert(options, html)` and `alert(html)(options)`, with the arity in a named constant.

```ts
import { create } from "@stylexjs/stylex";
import type { Html, HtmlBuilder } from "foldkit/html";

import { styleAttributes } from "@repo/ui/style";
import { colors, radius, space } from "@repo/ui/tokens.stylex";

const styles = create({
  alert: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: "1px",
    color: colors.cardForeground,
    padding: space.xl,
  },
});

const alertView = (message: string, html: HtmlBuilder<never>): Html =>
  html.div([html.Role("alert"), ...styleAttributes(styles.alert)], [message]);
```

`html.Role("alert")` makes screen readers announce the alert as soon as it appears. Look at `packages/ui/src/badge/badge.view.ts` for the complete pattern: the variant schema, the `render` function, the `Fn.dual` export and the `data-variant` attribute tests read.

## 3. Export it

Add `"./alert": "./src/alert/alert.view.ts"` to `exports` in `packages/ui/package.json`. Apps import the subpath; there is no barrel file, and the `barrel-imports` rule refuses one.

## 4. Write Scene tests

Create `packages/ui/tests/<name>/<name>.view.test.ts`, mirroring the source path. A Scene renders a tiny FoldKit program and checks what a person would see. Test what the component promises, not how it is styled:

- it shows its content;
- it marks each variant (`data-variant`);
- it has the role and accessible name a screen reader needs;
- it takes or refuses clicks, as it should.

[Testing](/guides/testing#scene-tests) has a complete Scene test you can copy.

## 5. Add it to the gallery

`packages/ui/gallery` renders every component in both themes. Add a sample to `samples.view.ts` so the component is seen in light and dark before anyone uses it.

## How to check it

```bash
mise exec -- pnpm exec turbo run test build --filter=@repo/ui
```

The tests run without a browser, and `build` writes the gallery to the package's `dist/` folder. Open its `index.html` and look at the component in both themes, including the focus ring, which must reach a contrast of 3:1.
