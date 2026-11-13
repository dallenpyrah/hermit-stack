import { describe, it } from "@effect/vitest";
import { Effect } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import type { Return } from "foldkit/update";
import { expect as sceneExpect, given, label as byLabel, scene, text } from "foldkit/scene";

import { label } from "#src/label/label.view.js";

type Model = Readonly<{ isDisabled: boolean }>;

const update = (model: Model): Return<Model, never> => ({ model });

const view = (model: Model, html: HtmlBuilder<never>): Html =>
  html.div(
    [],
    [
      label({ content: ["Display name"], fieldId: "display-name", isDisabled: model.isDisabled }, html),
      html.input([html.Id("display-name"), html.Type("text")]),
      html.input([html.Id("other"), html.Type("text")]),
    ],
  );

const namesItsField = (): void => {
  scene(
    { update, view },
    given({ isDisabled: false }),
    sceneExpect(byLabel("Display name")).toHaveId("display-name"),
    sceneExpect(byLabel("Display name")).not.toHaveId("other"),
  );
};

const showsItsContent = (): void => {
  scene({ update, view }, given({ isDisabled: true }), sceneExpect(text("Display name")).toExist());
};

describe("a label", () => {
  it.effect("names the field whose id it was given", () => Effect.sync(namesItsField));
  it.effect("still names its field when shown as disabled", () => Effect.sync(showsItsContent));
});
