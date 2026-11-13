import {
  AcquireResources,
  CloseDialog,
  Message as DialogMessage,
  ShowDialog,
  init,
  update as dialogUpdate,
  view as dialogView,
} from "@foldkit/ui/dialog";
import type { Model as DialogModel } from "@foldkit/ui/dialog";
import { describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { mapMessages } from "foldkit/command";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { Command, Mount, click, expect as sceneExpect, given, role, scene, selector } from "foldkit/scene";
import type { SceneStep } from "foldkit/scene";
import type { Return } from "foldkit/update";

import { button } from "#src/button/button.view.js";
import { dialogViewInputs } from "#src/dialog/dialog.view.js";
import type { CloseAttributes } from "#src/dialog/dialog.view.js";

const Message = defineMessageUnion({ GotDialog: { message: DialogMessage } });

type Message = typeof Message.Type;

type Model = Readonly<{ dialog: DialogModel; hasCloseButton: boolean }>;

const toMessage = (message: DialogMessage): Message => Message.GotDialog({ message });

const update = (model: Model, message: Message): Return<Model, Message> => {
  const next = dialogUpdate(model.dialog, message.message);

  return { commands: mapMessages(next.commands ?? [], toMessage), model: { ...model, dialog: next.model } };
};

const openDialog = toMessage(DialogMessage.RequestedOpen());

const view = (model: Model, html: HtmlBuilder<Message>): Html => {
  const trigger = button({ content: ["Delete project"], onClick: openDialog, variant: "destructive" }, html);

  const cancel = (close: CloseAttributes): Html =>
    button({ attributes: close, content: ["Cancel"], variant: "outline" }, html);

  const body = html.p([], ["The project and its history are removed for everyone."]);

  const viewInputs = dialogViewInputs(
    {
      actions: (close) => [cancel(close)],
      body: [body],
      description: ["This cannot be undone."],
      hasCloseButton: model.hasCloseButton,
      title: ["Delete project?"],
    },
    html,
  );

  const dialog = html.submodel({
    model: model.dialog,
    slotId: model.dialog.id,
    toParentMessage: toMessage,
    view: dialogView,
    viewInputs,
  });

  return html.div([], [trigger, dialog]);
};

const closed = (hasCloseButton: boolean): Model => ({ dialog: init({ id: "delete-project" }), hasCloseButton });

// Scene steps keep state once run, so each scene gets fresh ones.
const open = (): readonly SceneStep<Model, Message, undefined>[] => [
  click(role("button", { name: "Delete project" })),
  Command.resolve(ShowDialog, DialogMessage.SucceededShowDialog()),
  Mount.resolve(AcquireResources, DialogMessage.SucceededAcquireResources()),
];

const closedAfter = (): readonly SceneStep<Model, Message, undefined>[] => [
  Command.resolve(CloseDialog, DialogMessage.CompletedCloseDialog()),
  Mount.expectEnded(AcquireResources),
  sceneExpect(role("heading", { name: "Delete project?" })).toBeAbsent(),
];

const startsClosed = (): void => {
  scene(
    { update, view },
    given(closed(true)),
    sceneExpect(role("heading", { name: "Delete project?" })).toBeAbsent(),
    sceneExpect(selector("dialog")).not.toHaveAttr("aria-modal"),
  );
};

const opensNamedAndModal = (): void => {
  scene(
    { update, view },
    given(closed(true)),
    ...open(),
    sceneExpect(selector("dialog")).toHaveAccessibleName("Delete project?"),
    sceneExpect(selector("dialog")).toHaveAccessibleDescription("This cannot be undone."),
    sceneExpect(selector("dialog")).toHaveAttr("aria-modal", "true"),
    sceneExpect(role("heading", { level: 2, name: "Delete project?" })).toExist(),
    sceneExpect(role("button", { name: "Close" })).toExist(),
  );
};

const escapeIsWired = (): void => {
  scene({ update, view }, given(closed(true)), ...open(), sceneExpect(selector("dialog")).toHaveHandler("cancel"));
};

const actionCloses = (): void => {
  scene({ update, view }, given(closed(true)), ...open(), click(role("button", { name: "Cancel" })), ...closedAfter());
};

const cornerButtonCloses = (): void => {
  scene({ update, view }, given(closed(true)), ...open(), click(role("button", { name: "Close" })), ...closedAfter());
};

const overlayCloses = (): void => {
  scene({ update, view }, given(closed(true)), ...open(), click(selector('[data-part="overlay"]')), ...closedAfter());
};

const cornerButtonCanBeLeftOut = (): void => {
  scene(
    { update, view },
    given(closed(false)),
    ...open(),
    sceneExpect(role("button", { name: "Close" })).toBeAbsent(),
    sceneExpect(role("button", { name: "Cancel" })).toExist(),
  );
};

describe("a dialog", () => {
  it.effect("starts closed, with nothing shown", () => Effect.sync(startsClosed));
  it.effect("opens as a modal named by its title and described by its description", () =>
    Effect.sync(opensNamedAndModal),
  );
  it.effect("listens for the cancel event FoldKit sends on Escape", () => Effect.sync(escapeIsWired));
  it.effect("closes from a button in its actions", () => Effect.sync(actionCloses));
  it.effect("closes from its corner button", () => Effect.sync(cornerButtonCloses));
  it.effect("closes on a click on the overlay", () => Effect.sync(overlayCloses));
  it.effect("leaves out the corner button when asked to", () => Effect.sync(cornerButtonCanBeLeftOut));
});
