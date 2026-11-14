import { Effect, FileSystem, Path } from "effect";

import { LedgerApi } from "@repo/ledger/api";

import { panel, panels } from "#src/server/panel.layer.js";

const builtDocument = new globalThis.URL("../../../../apps/panels/dist/account.html", import.meta.url);

const accountHtml = Effect.gen(function* accountHtml() {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = yield* path.fromFileUrl(builtDocument);

  return yield* fs.readFileString(file);
});

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
