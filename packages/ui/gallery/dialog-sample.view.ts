import { Message as DialogMessage, view as dialogView } from "@foldkit/ui/dialog";
import type { HtmlBuilder } from "foldkit/html";

import { button } from "#src/button/button.view.js";
import { dialogViewInputs } from "#src/dialog/dialog.view.js";
import { input } from "#src/input/input.view.js";
import { label } from "#src/label/label.view.js";
import type { Content } from "#src/style/style.view.js";

import { Message } from "./gallery.message.js";
import type { Model, Side } from "./gallery.model.js";

const dialogBody = (side: Side, email: string, html: HtmlBuilder<Message>): Content => {
  const id = `${side}-dialog-email`;

  const field = input(
    {
      id,
      onInput: (value) => Message.ChangedEmail({ value }),
      placeholder: "you@example.com",
      type: "email",
      value: email,
    },
    html,
  );

  return [label({ content: ["Email"], fieldId: id }, html), field];
};

type DialogSampleContext = Readonly<{ html: HtmlBuilder<Message>; model: Model; side: Side }>;

const dialog = ({ html, model, side }: DialogSampleContext): Content => {
  const toMessage = Message.GotDialogMessage;
  const dialogModel = model.dialogs[side];

  const open = button(
    {
      content: ["Open dialog"],
      onClick: toMessage({ message: DialogMessage.RequestedOpen(), side }),
      variant: "outline",
    },
    html,
  );

  const viewInputs = dialogViewInputs(
    {
      actions: (close) => [
        button({ attributes: close, content: ["Cancel"], variant: "outline" }, html),
        button({ attributes: close, content: ["Save changes"] }, html),
      ],
      body: dialogBody(side, model.email, html),
      description: ["Changes to your profile are saved when you press Save."],
      title: ["Edit profile"],
    },
    html,
  );

  const submodel = html.submodel({
    model: dialogModel,
    slotId: dialogModel.id,
    toParentMessage: (message) => toMessage({ message, side }),
    view: dialogView,
    viewInputs,
  });

  return [html.div([], [open]), submodel];
};

export { dialog };
