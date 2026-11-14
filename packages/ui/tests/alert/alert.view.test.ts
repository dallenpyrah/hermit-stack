import { describe, it } from "@effect/vitest";
import { Effect } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import type { Return } from "foldkit/update";
import { expect as sceneExpect, given, role, scene, text } from "foldkit/scene";

import { alert } from "#src/alert/alert.view.js";
import type { AlertOptions } from "#src/alert/alert.view.js";

type Model = Readonly<{ options: AlertOptions }>;

const update = (model: Model): Return<Model, never> => ({ model });

const view = (model: Model, html: HtmlBuilder<never>): Html => alert(model.options, html);

const announcesAnOutcomePolitely = (): void => {
  scene(
    { update, view },
    given({ options: { description: ["Your balance is now $7.50."], title: ["Deposited $2.50"] } }),
    sceneExpect(role("status")).toExist(),
    sceneExpect(role("alert")).toBeAbsent(),
    sceneExpect(role("status")).toHaveAttr("data-variant", "default"),
    sceneExpect(text("Deposited $2.50")).toExist(),
    sceneExpect(text("Your balance is now $7.50.")).toExist(),
  );
};

const interruptsForAFailure = (): void => {
  scene(
    { update, view },
    given({ options: { title: ["Withdrawal refused"], variant: "destructive" } }),
    sceneExpect(role("alert")).toExist(),
    sceneExpect(role("status")).toBeAbsent(),
    sceneExpect(role("alert")).toHaveAttr("data-variant", "destructive"),
  );
};

const leavesOutAMissingDescription = (): void => {
  scene({ update, view }, given({ options: { title: ["Saved"] } }), sceneExpect(role("status")).toHaveText("Saved"));
};

describe("an alert", () => {
  it.effect("announces an outcome as a status, with its title and description", () =>
    Effect.sync(announcesAnOutcomePolitely),
  );
  it.effect("announces a failure as an alert", () => Effect.sync(interruptsForAFailure));
  it.effect("shows only its title when it has no description", () => Effect.sync(leavesOutAMissingDescription));
});
