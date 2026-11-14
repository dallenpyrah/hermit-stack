import { Layer } from "effect";
import { makeApplication, run } from "foldkit/runtime";

import { browserPanelHost } from "@repo/mcp-app/browser";

import { Message } from "#src/account/account.message.js";
import { Model } from "#src/account/account.model.js";
import { subscriptions } from "#src/account/account.subscription.js";
import { init, update } from "#src/account/account.update.js";
import { crashView, view } from "#src/account/account.view.js";

// The panel's connection to its host is built once, on the first Subscription, and kept while the panel is open. A
// Page with no MCP Apps host around it cannot show anything, so a failed handshake shows the crash view.
const host = Layer.orDie(browserPanelHost({ name: "hermit-stack-account-panel", version: "0.0.0" }));

run(
  makeApplication({
    Model,
    container: globalThis.document.querySelector("#root"),
    crash: { view: (_context, html) => crashView(html) },
    devTools: { Message },
    init,
    resources: host,
    subscriptions,
    update,
    view,
  }),
);
