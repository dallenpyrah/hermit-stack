import { makeApplication, run } from "foldkit/runtime";

import { Message } from "./gallery.message.js";
import { Model } from "./gallery.model.js";
import { init, update } from "./gallery.update.js";
import { view } from "./gallery.view.js";

run(
  makeApplication({
    Model,
    container: globalThis.document.querySelector("#root"),
    devTools: { Message },
    init,
    update,
    view,
  }),
);
