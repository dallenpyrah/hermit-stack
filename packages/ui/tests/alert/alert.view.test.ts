import { describe, it } from "@effect/vitest";
import { Effect } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import type { Return } from "foldkit/update";
import { expect as sceneExpect, given, role, scene, text } from "foldkit/scene";

import { alert } from "#src/alert/alert.view.js";

type Model = Readonly<{ isRefused: boolean }>;

const update = (model: Model): Return<Model, never> => ({ model });

const refused = (html: HtmlBuilder<never>): Html =>
  alert({ description: ["You have $5.00."], title: ["Not enough money"], variant: "destructive" }, html);

const saved = (html: HtmlBuilder<never>): Html => alert({ title: ["Saved"] }, html);

const view = (model: Model, html: HtmlBuilder<never>): Html => {
  if (model.isRefused) {
    return html.div([], [refused(html)]);
  }

  return html.div([], [saved(html)]);
};

const announcesTitleAndDescription = (): void => {
  scene(
    { update, view },
    given({ isRefused: true }),
    sceneExpect(role("alert")).toContainText("Not enough money"),
    sceneExpect(role("alert")).toContainText("You have $5.00."),
    sceneExpect(role("alert")).toHaveAttr("data-variant", "destructive"),
  );
};

const defaultsWithoutDescription = (): void => {
  scene(
    { update, view },
    given({ isRefused: false }),
    sceneExpect(role("alert")).toHaveAttr("data-variant", "default"),
    sceneExpect(text("Saved")).toExist(),
    sceneExpect(text("You have $5.00.")).toBeAbsent(),
  );
};

describe("an alert", () => {
  it.effect("is announced with its title and description", () => Effect.sync(announcesTitleAndDescription));
  it.effect("is the default variant and leaves out a missing description", () =>
    Effect.sync(defaultsWithoutDescription),
  );
});
