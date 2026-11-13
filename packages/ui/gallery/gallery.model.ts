import { Model as DialogModel } from "@foldkit/ui/dialog";
import { Schema } from "effect";

// The gallery shows every component twice, once in each theme, so each side has its own dialog.
const Side = Schema.Literals(["light", "dark"]);

type Side = typeof Side.Type;

const Model = Schema.Struct({
  dialogs: Schema.Struct({ dark: DialogModel, light: DialogModel }),
  email: Schema.String,
});

type Model = typeof Model.Type;

export { Model, Side };
