import { Model as DialogModel } from "@foldkit/ui/dialog";
import { Schema } from "effect";

const Side = Schema.Literals(["light", "dark"]);

type Side = typeof Side.Type;

const Model = Schema.Struct({
  dialogs: Schema.Struct({ dark: DialogModel, light: DialogModel }),
  email: Schema.String,
});

type Model = typeof Model.Type;

export { Model, Side };
