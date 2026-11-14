import { layerTest } from "@effect/platform-node/NodeHttpServer";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { handleRequest } from "foldkit/experimental/server";

import { AccountId } from "@repo/ledger/account-id";
import { LedgerApi } from "@repo/ledger/api";

import { renderDocument, renderPage } from "#src/entry/server.page.js";
import { ledgerRoutes, localLedger } from "#src/server/local-origin.layer.js";

const origin = HttpRouter.serve(ledgerRoutes, { disableListenLog: true, disableLogger: true }).pipe(
  Layer.provideMerge(localLedger),
  Layer.provideMerge(layerTest),
);

const assets = { entryScript: "/src/entry/browser.main.ts", modulePreloads: [], stylesheets: [] };

const ok = 200;

const notFound = 404;

const fetchPage = Effect.fn("fetchPage")(function* fetchPageEffect(path: string) {
  const address = yield* HttpServer.addressFormattedWith((formatted) => Effect.succeed(formatted));
  const request = new globalThis.Request(`${address}${path}`, { headers: { accept: "text/html" } });

  const response = yield* Effect.promise(() =>
    handleRequest(request, { renderDocument: renderDocument(assets), renderPage }),
  );

  const html = yield* Effect.promise(() => response.text());

  return { html, response };
});

const openGrace = Effect.fn("openGrace")(function* openGraceEffect() {
  const ledger = yield* LedgerApi.clientInProcess;
  const account = AccountId.make("ssr-grace");

  yield* ledger.OpenAccount(account, { owner: "Grace" });
  yield* ledger.DepositMoney(account, { amount: 5000 });
  yield* ledger.WithdrawMoney(account, { amount: 679 });
}, Effect.scoped);

const rendersTheBalanceInTheHtml = Effect.fn("rendersTheBalanceInTheHtml")(function* rendersTheBalanceInTheHtmlCase() {
  yield* openGrace();

  const { html, response } = yield* fetchPage("/accounts/ssr-grace");
  const cacheControl = response.headers.get("cache-control");

  expect({ cacheControl, status: response.status }).toStrictEqual({ cacheControl: "private, no-store", status: ok });
  expect(html).toContain("$43.21");
  expect(html).toContain("Grace");
  expect(html).toContain('{"state":{"balance":4321,"owner":"Grace","status":"open"},"cursor":3}');
  expect(html).not.toMatch(/loading|aria-busy|spinner|skeleton/iu);
});

const rendersAnUnknownAccountAsAnAnswer = Effect.fn("rendersAnUnknownAccountAsAnAnswer")(
  function* rendersAnUnknownAccountAsAnAnswerCase() {
    const { html, response } = yield* fetchPage("/accounts/ssr-nobody");

    expect(response.status).toBe(ok);
    expect(html).toContain("No account ssr-nobody");
    expect(html).not.toMatch(/loading|aria-busy/iu);
  },
);

const refusesOtherPaths = Effect.fn("refusesOtherPaths")(function* refusesOtherPathsCase() {
  const { response } = yield* fetchPage("/accounts");

  expect(response.status).toBe(notFound);
});

describe("the account page rendered on the server", () => {
  it.layer(origin)("next to the ledger's routes", (onServer) => {
    onServer.effect("sends the balance in the HTML with no loading state", rendersTheBalanceInTheHtml);
    onServer.effect("renders an id with no account as a page that says so", rendersAnUnknownAccountAsAnAnswer);
    onServer.effect("answers a path that names no account with 404", refusesOtherPaths);
  });
});
