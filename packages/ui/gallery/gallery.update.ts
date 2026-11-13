import { init as initDialog, update as updateDialog } from "@foldkit/ui/dialog";
import type { Message as DialogMessage } from "@foldkit/ui/dialog";
import { Function as Fn } from "effect";
import { mapMessages } from "foldkit/command";
import type { Return } from "foldkit/update";

import { Message } from "./gallery.message.js";
import type { Model, Side } from "./gallery.model.js";

const foldDialog = (model: Model, side: Side, message: DialogMessage): Return<Model, Message> => {
  const next = updateDialog(model.dialogs[side], message);

  const toMessage = (dialogMessage: DialogMessage): Message =>
    Message.GotDialogMessage({ message: dialogMessage, side });

  return {
    commands: mapMessages(next.commands ?? [], toMessage),
    model: { ...model, dialogs: { ...model.dialogs, [side]: next.model } },
  };
};

const init = (): Return<Model, Message> => ({
  model: {
    dialogs: {
      dark: initDialog({ id: "gallery-dialog-dark" }),
      light: initDialog({ id: "gallery-dialog-light" }),
    },
    email: "",
  },
});

const updateArity = 2;

const update: {
  (message: Message): (model: Model) => Return<Model, Message>;
  (model: Model, message: Message): Return<Model, Message>;
} = Fn.dual(updateArity, (model: Model, message: Message): Return<Model, Message> =>
  Message.match(message, {
    ChangedEmail: ({ value }): Return<Model, Message> => ({ model: { ...model, email: value } }),
    GotDialogMessage: ({ message: dialogMessage, side }): Return<Model, Message> =>
      foldDialog(model, side, dialogMessage),
  }),
);

export { init, update };
