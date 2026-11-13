import { describe, it } from "@effect/vitest";
import { Effect } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import type { Return } from "foldkit/update";
import { expect as sceneExpect, given, role, scene, text } from "foldkit/scene";

import { card } from "#src/card/card.view.js";
import type { CardOptions } from "#src/card/card.view.js";

type Model = Readonly<{ options: CardOptions }>;

const update = (model: Model): Return<Model, never> => ({ model });

const view = (model: Model, html: HtmlBuilder<never>): Html => card(model.options, html);

const full: CardOptions = {
  action: ["Edit"],
  body: ["Next payment on 1 December."],
  description: ["Billed monthly"],
  footer: ["Cancel any time"],
  title: ["Pro plan"],
};

const titleIsAHeading = (): void => {
  scene(
    { update, view },
    given({ options: full }),
    sceneExpect(role("heading", { level: 3, name: "Pro plan" })).toExist(),
    sceneExpect(text("Billed monthly")).toExist(),
    sceneExpect(text("Edit")).toExist(),
    sceneExpect(text("Next payment on 1 December.")).toExist(),
    sceneExpect(text("Cancel any time")).toExist(),
  );
};

const leavesOutMissingParts = (): void => {
  scene(
    { update, view },
    given({ options: { title: ["Pro plan"] } }),
    sceneExpect(role("heading", { name: "Pro plan" })).toExist(),
    sceneExpect(role("paragraph")).toBeAbsent(),
    sceneExpect(text("Billed monthly")).toBeAbsent(),
  );
};

describe("a card", () => {
  it.effect("renders its title as a heading with every part it is given", () => Effect.sync(titleIsAHeading));
  it.effect("renders only the title when given only a title", () => Effect.sync(leavesOutMissingParts));
});
