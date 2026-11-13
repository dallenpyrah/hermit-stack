import { describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import type { Return } from "foldkit/update";
import { defineMessageUnion } from "foldkit/message";
import { expect as sceneExpect, given, label as byLabel, scene, type as typeInto } from "foldkit/scene";

import { input } from "#src/input/input.view.js";
import type { InputOptions } from "#src/input/input.view.js";
import { label } from "#src/label/label.view.js";

const Message = defineMessageUnion({ ChangedEmail: { value: Schema.String } });

type Message = typeof Message.Type;

const Model = Schema.Struct({ email: Schema.String });

type Model = typeof Model.Type;

const update = (_model: Model, message: Message): Return<Model, Message> => ({ model: { email: message.value } });

const host =
  (options: Partial<InputOptions<Message>>) =>
  (model: Model, html: HtmlBuilder<Message>): Html =>
    html.div(
      [],
      [
        label({ content: ["Email"], fieldId: "email" }, html),
        input(
          {
            id: "email",
            onInput: (value) => Message.ChangedEmail({ value }),
            placeholder: "you@example.com",
            type: "email",
            value: model.email,
            ...options,
          },
          html,
        ),
      ],
    );

const field = byLabel("Email");

const typingUpdatesTheValue = (): void => {
  scene(
    { update, view: host({}) },
    given({ email: "" }),
    typeInto(field, "ada@example.com"),
    sceneExpect(field).toHaveValue("ada@example.com"),
    sceneExpect(field).toHaveAttr("type", "email"),
    sceneExpect(field).toHaveAttr("placeholder", "you@example.com"),
  );
};

const invalidIsAnnounced = (): void => {
  scene(
    { update, view: host({ isInvalid: true }) },
    given({ email: "ada" }),
    sceneExpect(field).toHaveAttr("aria-invalid", "true"),
  );
};

const validIsNotMarked = (): void => {
  scene({ update, view: host({}) }, given({ email: "ada" }), sceneExpect(field).not.toHaveAttr("aria-invalid"));
};

const disabledTakesNoInput = (): void => {
  scene(
    { update, view: host({ isDisabled: true }) },
    given({ email: "ada@example.com" }),
    sceneExpect(field).toBeDisabled(),
    sceneExpect(field).not.toHaveHandler("input"),
  );
};

describe("an input", () => {
  it.effect("is found by its label and reports what is typed", () => Effect.sync(typingUpdatesTheValue));
  it.effect("sets aria-invalid when invalid", () => Effect.sync(invalidIsAnnounced));
  it.effect("leaves aria-invalid off when valid", () => Effect.sync(validIsNotMarked));
  it.effect("when disabled, is disabled and has no input handler", () => Effect.sync(disabledTakesNoInput));
});
