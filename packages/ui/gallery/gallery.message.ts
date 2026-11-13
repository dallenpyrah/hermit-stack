import { Message as DialogMessage } from "@foldkit/ui/dialog";
import { Schema } from "effect";
import { defineMessageUnion } from "foldkit/message";

import { Side } from "./gallery.model.js";

const Message = defineMessageUnion({
  ChangedEmail: { value: Schema.String },
  GotDialogMessage: { message: DialogMessage, side: Side },
});

type Message = typeof Message.Type;

export { Message };
