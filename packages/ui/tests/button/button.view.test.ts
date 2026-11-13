import { describe, it } from "@effect/vitest";
import { Effect, Number as Num, Schema } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import type { Return } from "foldkit/update";
import { defineMessageUnion } from "foldkit/message";
import { click, expect as sceneExpect, given, role, scene } from "foldkit/scene";

import { button } from "#src/button/button.view.js";
import type { ButtonOptions } from "#src/button/button.view.js";

const Message = defineMessageUnion({ ClickedSave: {} });

type Message = typeof Message.Type;

const Model = Schema.Struct({ saves: Schema.Finite });

type Model = typeof Model.Type;

const update = (model: Model): Return<Model, Message> => ({ model: { saves: Num.increment(model.saves) } });

const host =
  (options: Omit<ButtonOptions<Message>, "onClick">) =>
  (model: Model, html: HtmlBuilder<Message>): Html =>
    html.div(
      [],
      [button({ ...options, onClick: Message.ClickedSave() }, html), html.p([], [`Saved ${model.saves} times`])],
    );

const firesOnClick = (): void => {
  scene(
    { update, view: host({ content: ["Save"] }) },
    given({ saves: 0 }),
    click(role("button", { name: "Save" })),
    click(role("button", { name: "Save" })),
    sceneExpect(role("paragraph")).toHaveText("Saved 2 times"),
  );
};

const defaultsToPrimaryMedium = (): void => {
  scene(
    { update, view: host({ content: ["Save"] }) },
    given({ saves: 0 }),
    sceneExpect(role("button", { name: "Save" })).toHaveAttr("data-variant", "primary"),
    sceneExpect(role("button", { name: "Save" })).toHaveAttr("data-size", "md"),
    sceneExpect(role("button", { name: "Save" })).toHaveAttr("type", "button"),
  );
};

const marksVariantAndSize = (): void => {
  scene(
    { update, view: host({ content: ["Delete"], size: "sm", type: "submit", variant: "destructive" }) },
    given({ saves: 0 }),
    sceneExpect(role("button", { name: "Delete" })).toHaveAttr("data-variant", "destructive"),
    sceneExpect(role("button", { name: "Delete" })).toHaveAttr("data-size", "sm"),
    sceneExpect(role("button", { name: "Delete" })).toHaveAttr("type", "submit"),
  );
};

const disabledStaysFocusable = (): void => {
  scene(
    { update, view: host({ content: ["Save"], isDisabled: true }) },
    given({ saves: 0 }),
    sceneExpect(role("button", { name: "Save" })).toHaveAttr("aria-disabled", "true"),
    sceneExpect(role("button", { name: "Save" })).toBeDisabled(),
    sceneExpect(role("button", { name: "Save" })).not.toHaveAttr("disabled"),
    sceneExpect(role("button", { name: "Save" })).not.toHaveHandler("click"),
  );
};

const iconOnlyIsNamedByLabel = (): void => {
  scene(
    { update, view: host({ content: ["+"], iconOnly: { label: "Add item" }, variant: "outline" }) },
    given({ saves: 0 }),
    click(role("button", { name: "Add item" })),
    sceneExpect(role("paragraph")).toHaveText("Saved 1 times"),
  );
};

describe("a button", () => {
  it.effect("dispatches its onClick Message on each click", () => Effect.sync(firesOnClick));
  it.effect("is a primary, medium, non-submitting button by default", () => Effect.sync(defaultsToPrimaryMedium));
  it.effect("marks the variant, size and type it was given", () => Effect.sync(marksVariantAndSize));
  it.effect("when disabled, drops its click handler but stays in the tab order", () =>
    Effect.sync(disabledStaysFocusable),
  );
  it.effect("when icon only, takes its accessible name from the label", () => Effect.sync(iconOnlyIsNamedByLabel));
});
