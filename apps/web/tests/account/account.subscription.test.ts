import { layerTest } from "@effect/platform-node/NodeHttpServer";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Context, Effect, Layer, Match, Number as Num, Option, Stream, SubscriptionRef } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";

import { AccountId } from "@repo/ledger/account-id";
import { LedgerApi } from "@repo/ledger/api";

import { subscriptions } from "#src/account/account.subscription.js";
import { init, update } from "#src/account/account.update.js";
import { ledgerConnection } from "#src/entry/ledger-connection.layer.js";
import { ledgerRoutes, localLedger } from "#src/server/local-origin.layer.js";

class Gate extends Context.Service<Gate, SubscriptionRef.SubscriptionRef<boolean>>()(
  "@repo/web/tests/account/account.subscription.test/Gate",
) {}

const unavailable = 503;

const closed = HttpServerResponse.text("Closed for the test", { status: unavailable });

const whenClosed = (
  gate: SubscriptionRef.SubscriptionRef<boolean>,
): Effect.Effect<HttpServerResponse.HttpServerResponse> =>
  SubscriptionRef.changes(gate).pipe(
    Stream.filter((isOpen) => !isOpen),
    Stream.runHead,
    Effect.as(closed),
  );

const served = HttpRouter.serve(ledgerRoutes, {
  disableListenLog: true,
  disableLogger: true,
  middleware: (app) =>
    Effect.gen(function* throughTheGate() {
      const gate = yield* Gate;
      const isOpen = yield* SubscriptionRef.get(gate);

      if (!isOpen) {
        return closed;
      }

      return yield* Effect.raceFirst(app, whenClosed(gate));
    }),
});

const openGate = Layer.effect(Gate, SubscriptionRef.make(true));

const origin = served.pipe(
  Layer.provideMerge(localLedger),
  Layer.provideMerge(openGate),
  Layer.provideMerge(layerTest),
);

const patience = "10 seconds";

type Model = ReturnType<typeof init>["model"];

type Page = Readonly<{ caughtUp: number; delivered: readonly number[]; model: Model }>;

type Message = Stream.Success<ReturnType<typeof subscriptions.account.dependenciesToStream>>;

const record = (page: Page, message: Message): Page => {
  const { model } = update(page.model, message);

  return Match.value(message).pipe(
    Match.tag("CaughtUp", (): Page => ({ ...page, caughtUp: Num.increment(page.caughtUp), model })),
    Match.tag("GotAccount", ({ account }): Page => ({
      ...page,
      delivered: Arr.append(page.delivered, account.cursor),
      model,
    })),
    Match.orElse((): Page => ({ ...page, model })),
  );
};

const openPage = Effect.fn("openPage")(function* openPageEffect(account: AccountId) {
  const client = yield* LedgerApi.clientInProcess;
  const snapshot = yield* client.Balance.snapshot(account);
  const firstModel = init({ account: snapshot, accountId: account, session: "test", theme: "light" }).model;
  const page = yield* SubscriptionRef.make<Page>({ caughtUp: 0, delivered: [], model: firstModel });
  const baseUrl = yield* HttpServer.addressFormattedWith((formatted) => Effect.succeed(formatted));
  const connection = yield* Layer.build(ledgerConnection(baseUrl));
  const feed = subscriptions.account;

  const dependencies = (): ReturnType<typeof feed.modelToDependencies> =>
    feed.modelToDependencies(SubscriptionRef.getUnsafe(page).model);

  yield* feed.dependenciesToStream(dependencies(), dependencies).pipe(
    Stream.runForEach((message) => SubscriptionRef.update(page, (shown) => record(shown, message))),
    Effect.provideContext(connection),
    Effect.forkScoped,
  );

  return page;
});

const awaitPage = Effect.fn("awaitPage")(function* awaitPageEffect(
  page: SubscriptionRef.SubscriptionRef<Page>,
  isReady: (shown: Page) => boolean,
) {
  const ready = yield* SubscriptionRef.changes(page).pipe(
    Stream.filter(isReady),
    Stream.runHead,
    Effect.timeout(patience),
  );

  return yield* Effect.fromOption(ready);
});

const balanceOf = (page: Page): Option.Option<number> => Option.map(page.model.account.state, (state) => state.balance);

const isLive = (page: Page): boolean => page.model.feed === "Live";

const holds =
  (cents: number) =>
  (page: Page): boolean =>
    Option.contains(balanceOf(page), cents);

const deposit = Effect.fn("deposit")(function* depositEffect(account: AccountId, amount: number) {
  const client = yield* LedgerApi.clientInProcess;

  yield* client.DepositMoney(account, { amount });
}, Effect.scoped);

const openAccount = Effect.fn("openAccount")(function* openAccountEffect(account: AccountId, amount: number) {
  const client = yield* LedgerApi.clientInProcess;

  yield* client.OpenAccount(account, { owner: "Lin" });
  yield* client.DepositMoney(account, { amount });
}, Effect.scoped);

const setGate = Effect.fn("setGate")(function* setGateEffect(isOpen: boolean) {
  const gate = yield* Gate;

  yield* SubscriptionRef.set(gate, isOpen);
});

const twoPages = {
  account: AccountId.make("live-two-pages"),
  after: 12_550,
  event: 3,
  moved: 2550,
  opened: 10_000,
};

const bothPagesSeeOneDepositOnce = Effect.fn("bothPagesSeeOneDepositOnce")(function* bothPagesSeeOneDepositOnceCase() {
  yield* openAccount(twoPages.account, twoPages.opened);

  const first = yield* openPage(twoPages.account);
  const second = yield* openPage(twoPages.account);

  yield* awaitPage(first, isLive);
  yield* awaitPage(second, isLive);
  yield* deposit(twoPages.account, twoPages.moved);

  const firstShown = yield* awaitPage(first, holds(twoPages.after));
  const secondShown = yield* awaitPage(second, holds(twoPages.after));

  expect([firstShown.delivered, secondShown.delivered]).toStrictEqual([[twoPages.event], [twoPages.event]]);
}, Effect.scoped);

const cutOff = {
  account: AccountId.make("live-reconnect"),
  afterLive: 6000,
  afterMissed: 8000,
  afterReturn: 8300,
  connections: 2,
  events: { live: 3, missed: 4, returned: 5 },
  live: 1000,
  missed: 2000,
  opened: 5000,
  returned: 300,
};

const missADepositWhileCut = Effect.fn("missADepositWhileCut")(function* missADepositWhileCutEffect(
  page: SubscriptionRef.SubscriptionRef<Page>,
) {
  yield* setGate(false);
  yield* deposit(cutOff.account, cutOff.missed);

  const whileCut = yield* SubscriptionRef.get(page);

  yield* setGate(true);
  yield* awaitPage(page, holds(cutOff.afterMissed));

  return whileCut;
});

const aReconnectedPageCatchesUp = Effect.fn("aReconnectedPageCatchesUp")(function* aReconnectedPageCatchesUpCase() {
  yield* openAccount(cutOff.account, cutOff.opened);

  const page = yield* openPage(cutOff.account);

  yield* awaitPage(page, isLive);
  yield* deposit(cutOff.account, cutOff.live);
  yield* awaitPage(page, holds(cutOff.afterLive));

  const whileCut = yield* missADepositWhileCut(page);

  yield* deposit(cutOff.account, cutOff.returned);

  const shown = yield* awaitPage(page, holds(cutOff.afterReturn));

  expect({ delivered: shown.delivered, whileCut: balanceOf(whileCut) }).toStrictEqual({
    delivered: [cutOff.events.live, cutOff.events.missed, cutOff.events.returned],
    whileCut: Option.some(cutOff.afterLive),
  });
  expect(shown.caughtUp).toBeGreaterThanOrEqual(cutOff.connections);
}, Effect.scoped);

const onTheRealClockForReconnectBackoff = { excludeTestServices: true };

describe("the account page's live feed", () => {
  it.layer(origin, onTheRealClockForReconnectBackoff)("over real WebSockets", (onServer) => {
    onServer.effect("shows a third party's deposit on two open pages, once each", bothPagesSeeOneDepositOnce);
    onServer.effect("catches a page up on a deposit it missed while its socket was dropped", aReconnectedPageCatchesUp);
  });
});
