import { hydrate, makeApplication } from "foldkit/runtime";

import { Message } from "#src/account/account.message.js";
import { Flags, Model } from "#src/account/account.model.js";
import { subscriptions } from "#src/account/account.subscription.js";
import { init, update } from "#src/account/account.update.js";
import { view } from "#src/account/account.view.js";
import { ledgerConnection } from "#src/entry/ledger-connection.layer.js";

hydrate(
  makeApplication({
    Flags,
    Model,
    container: globalThis.document.querySelector("#root"),
    devTools: { Message },
    init,
    resources: ledgerConnection(globalThis.location.origin),
    subscriptions,
    update,
    view,
  }),
);
