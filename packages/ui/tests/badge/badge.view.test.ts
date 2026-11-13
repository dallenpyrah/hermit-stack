import { describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import type { Return } from "foldkit/update";
import { expect as sceneExpect, given, scene, text } from "foldkit/scene";

import { badge, BadgeVariant } from "#src/badge/badge.view.js";

type Model = Readonly<{ count: number }>;

const update = (model: Model): Return<Model, never> => ({ model });

const view = (model: Model, html: HtmlBuilder<never>): Html =>
  html.div(
    [],
    [
      badge({ content: [`${model.count} new`] }, html),
      ...Arr.map(BadgeVariant.literals, (variant) => badge({ content: [`Badge ${variant}`], variant }, html)),
    ],
  );

const showsContent = (): void => {
  scene({ update, view }, given({ count: 3 }), sceneExpect(text("3 new")).toExist());
};

const defaultsToPrimary = (): void => {
  scene({ update, view }, given({ count: 3 }), sceneExpect(text("3 new")).toHaveAttr("data-variant", "primary"));
};

const marksEachVariant = (): void => {
  scene(
    { update, view },
    given({ count: 0 }),
    sceneExpect(text("Badge primary")).toHaveAttr("data-variant", "primary"),
    sceneExpect(text("Badge secondary")).toHaveAttr("data-variant", "secondary"),
    sceneExpect(text("Badge destructive")).toHaveAttr("data-variant", "destructive"),
    sceneExpect(text("Badge outline")).toHaveAttr("data-variant", "outline"),
  );
};

const isNotInteractive = (): void => {
  scene({ update, view }, given({ count: 1 }), sceneExpect(text("1 new")).not.toHaveHandler("click"));
};

describe("a badge", () => {
  it.effect("shows its content", () => Effect.sync(showsContent));
  it.effect("is primary by default", () => Effect.sync(defaultsToPrimary));
  it.effect("marks each of its variants", () => Effect.sync(marksEachVariant));
  it.effect("takes no clicks", () => Effect.sync(isNotInteractive));
});
