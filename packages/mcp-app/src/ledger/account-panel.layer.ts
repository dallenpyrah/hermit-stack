import { Effect, FileSystem, Path } from "effect";

import { LedgerApi } from "@repo/ledger/api";

import { panel, panels } from "#src/server/panel.layer.js";

// The single HTML document `apps/panels` builds. It is read from that app's build output on each resources/read, so the
// Server runs from this repo's source on Node; a bundled or edge target needs the document shipped beside it instead.
const builtDocument = new globalThis.URL("../../../../apps/panels/dist/account.html", import.meta.url);

const accountHtml = Effect.gen(function* accountHtml() {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = yield* path.fromFileUrl(builtDocument);

  return yield* fs.readFileString(file);
});

// The ledger's account panel: an agent host that runs Balance.get shows the account's balance with deposit and
// Withdraw buttons. Provide it to the ledger's toMcp tools, before the transport.
const accountPanel = panels([
  panel({
    api: LedgerApi,
    description: "An account's balance, with buttons to deposit or withdraw.",
    html: accountHtml,
    name: "Ledger account",
    prefersBorder: true,
    renders: ["Balance.get"],
    uri: "ui://hermit-stack/ledger/account",
  }),
]);

export { accountPanel };
