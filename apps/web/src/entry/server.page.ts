import { protocolHttp } from "@alchemy.run/domain";
import { Effect, Function as Fn, Layer, Option, Record as Rec, Schema, pipe } from "effect";
import { SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";
import { Rendered, Responded, renderDocument as foldkitDocument, renderToString } from "foldkit/experimental/server";
import type { DocumentAssets, EntryResult, RenderedApplication } from "foldkit/experimental/server";

import { LedgerApi } from "@repo/ledger/api";

import { Flags } from "#src/account/account.model.js";
import { init } from "#src/account/account.update.js";
import { view } from "#src/account/account.view.js";
import { ledger } from "#src/account/ledger.api.js";

type AccountId = typeof Flags.fields.accountId.Type;

type ThemeName = typeof Flags.fields.theme.Type;

const accountPath = /^\/accounts\/(?<accountId>[^/]+)\/?$/u;

const decodeAccountId = Schema.decodeUnknownOption(Flags.fields.accountId);

const decodeThemeName = Schema.decodeUnknownOption(Flags.fields.theme);

const decodePathSegment = Option.liftThrowable(decodeURIComponent);

const notFound = 404;

const methodNotAllowed = 405;

const unavailable = 503;

const plainHeaders = { "content-type": "text/plain; charset=utf-8" };

const plain = (status: number, body: string, headers: Readonly<Record<string, string>> = {}): EntryResult =>
  Responded(new globalThis.Response(body, { headers: { ...plainHeaders, ...headers }, status }));

const pageHeaders = {
  "cache-control": "private, no-store",
  vary: "cookie",
  "x-content-type-options": "nosniff",
};

const themeOf = (url: URL): ThemeName =>
  Option.getOrElse(decodeThemeName(url.searchParams.get("theme")), (): ThemeName => "light");

const accountIdOf = (url: URL): Option.Option<AccountId> =>
  pipe(
    Option.fromNullishOr(accountPath.exec(url.pathname)?.groups),
    Option.flatMap(Rec.get("accountId")),
    Option.flatMap(decodePathSegment),
    Option.flatMap(decodeAccountId),
  );

const forwardedHeaders = (request: Request): Readonly<Record<string, string>> =>
  Option.match(Option.fromNullishOr(request.headers.get("cookie")), {
    onNone: () => ({}),
    onSome: (cookie) => ({ cookie }),
  });

const accountPage = Effect.fn("accountPage")(function* accountPageEffect(request: Request, accountId: AccountId) {
  const client = yield* LedgerApi.Client;
  const url = new globalThis.URL(request.url);
  const snapshot = yield* client.Balance.snapshot(accountId, { headers: forwardedHeaders(request) });

  const account = yield* Schema.encodeEffect(ledger.Balance.SnapshotFlags)({
    cursor: snapshot.cursor,
    state: Option.fromNullishOr(snapshot.state),
  });

  const session = yield* SecureRandom.SecureRandom.use((random) => random.uuidV4());
  const flags: Flags = { account, accountId, session, theme: themeOf(url) };
  const application = yield* renderToString({ Flags, init, view }, { flags });

  return Rendered(application, { headers: pageHeaders });
});

type PageServices = typeof LedgerApi.Client.Identifier | SecureRandom.SecureRandom;

const readMethods = new Set(["GET", "HEAD"]);

const readAccount = (request: Request, accountId: AccountId): Effect.Effect<EntryResult, never, PageServices> =>
  accountPage(request, accountId).pipe(
    Effect.tapCause((cause) => Effect.logError("The account page could not read the ledger", cause)),
    Effect.orElseSucceed(() => plain(unavailable, "The ledger did not answer. Try again in a moment.")),
  );

const pageFor = (request: Request): Effect.Effect<EntryResult, never, PageServices> => {
  if (!readMethods.has(request.method)) {
    return Effect.succeed(plain(methodNotAllowed, "Method not allowed", { allow: "GET, HEAD" }));
  }

  return Option.match(accountIdOf(new globalThis.URL(request.url)), {
    onNone: () => Effect.succeed(plain(notFound, "Not found")),
    onSome: (accountId) => readAccount(request, accountId),
  });
};

const sameOriginLedger = (request: Request): Layer.Layer<PageServices> => {
  const rpcUrl = new globalThis.URL("/rpc", request.url);

  return LedgerApi.layerClient.pipe(
    Layer.provide(protocolHttp(rpcUrl.href)),
    Layer.provide(FetchHttpClient.layer),
    Layer.merge(SecureRandom.layerWebCrypto),
  );
};

const servePage = Effect.fn("servePage")(function* servePageEffect(request: Request) {
  const services = yield* Layer.build(sameOriginLedger(request));

  return yield* pageFor(request).pipe(Effect.provideContext(services));
}, Effect.scoped);

const renderPage = (request: Request): Promise<EntryResult> => Effect.runPromise(servePage(request));

const documentHead = "<style>body{margin:0}</style>";

const renderDocumentArity = 2;

const renderDocument: {
  (assets: DocumentAssets): (application: RenderedApplication) => string;
  (application: RenderedApplication, assets: DocumentAssets): string;
} = Fn.dual(renderDocumentArity, (application: RenderedApplication, assets: DocumentAssets): string =>
  foldkitDocument(application, assets, { head: documentHead, lang: "en" }),
);

export { renderDocument, renderPage };
