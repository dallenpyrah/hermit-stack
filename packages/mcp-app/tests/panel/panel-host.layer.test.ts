import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Fiber, Layer, Predicate, Result, Stream } from "effect";

import { LedgerApi } from "@repo/ledger/api";

import { accountPanel } from "#src/ledger/account-panel.layer.js";
import type { HostChannel } from "#src/panel/host-channel.service.js";
import { HostHandshakeError } from "#src/panel/host-handshake.errors.js";
import { panelHost } from "#src/panel/panel-host.layer.js";
import { PanelHost } from "#src/panel/panel-host.service.js";
import { ledgerAgent } from "#tests/ledger/account-panel.fake";
import type { AgentError } from "#tests/ledger/account-panel.fake";
import { FakeHost, fakeHost, firstOf, hostInfo } from "#tests/panel/host-channel.fake";
import type { FakeHostOptions } from "#tests/panel/host-channel.fake";

const appInfo = { name: "account-panel", version: "0.0.0" };

const opened: FakeHostOptions = {
  context: { locale: "en-US", theme: "light" },
  opening: { arguments: { key: "acct-1" }, name: "LedgerApi_Balance_get" },
  prepare: [
    { arguments: { input: { owner: "ada" }, target: "acct-1" }, name: "LedgerApi_OpenAccount_send" },
    { arguments: { input: { amount: 500 }, target: "acct-1" }, name: "LedgerApi_DepositMoney_send" },
  ],
  refuses: false,
};

// The handshake is the panel's first two messages: its ui/initialize request, then its initialized notification.
const handshakeLength = 2;

const panelOver = (
  options: FakeHostOptions,
): Layer.Layer<PanelHost | FakeHost | HostChannel, HostHandshakeError | AgentError> =>
  Layer.provideMerge(panelHost(appInfo), fakeHost(options)).pipe(Layer.provide(ledgerAgent(accountPanel)));

const handshakes = Effect.fn("handshakes")(function* handshakesCase() {
  const host = yield* PanelHost;
  const sent = yield* Effect.flatMap(FakeHost, (fake) => fake.sent);

  expect(host.hostInfo).toStrictEqual(hostInfo);
  expect(Arr.take(sent, handshakeLength)).toStrictEqual([
    {
      id: 1,
      jsonrpc: "2.0",
      method: "ui/initialize",
      params: { appCapabilities: { availableDisplayModes: ["inline"] }, appInfo, protocolVersion: "2026-01-26" },
    },
    { jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} },
  ]);
});

const receivesTheOpeningCall = Effect.fn("receivesTheOpeningCall")(function* receivesTheOpeningCallCase() {
  const host = yield* PanelHost;
  const input = yield* firstOf(host.toolInput(LedgerApi, "Balance.get"));
  const result = yield* firstOf(host.toolResult(LedgerApi, "Balance.get"));

  expect(input).toStrictEqual(Result.succeed({ key: "acct-1" }));
  expect(result).toStrictEqual(Result.succeed({ value: { balance: 500, owner: "ada", status: "open" } }));
});

const depositsThroughTheHost = Effect.fn("depositsThroughTheHost")(function* depositsThroughTheHostCase() {
  const host = yield* PanelHost;
  const deposit = yield* host.call(LedgerApi, "DepositMoney", { input: { amount: 250 }, target: "acct-1" });
  const balance = yield* host.call(LedgerApi, "Balance.get", { atLeast: deposit, key: "acct-1" });

  expect(deposit.reply).toStrictEqual({ balance: 750 });
  expect(balance.value).toStrictEqual({ balance: 750, owner: "ada", status: "open" });
});

const refusesAnOverdraft = Effect.fn("refusesAnOverdraft")(function* refusesAnOverdraftCase() {
  const host = yield* PanelHost;
  const withdrawal = host.call(LedgerApi, "WithdrawMoney", { input: { amount: 900 }, target: "acct-1" });
  const failure = yield* Effect.flip(withdrawal);

  expect(Predicate.isTagged(failure, "InsufficientFunds")).toBe(true);
  expect(failure).toMatchObject({ balance: 750, requested: 900 });
});

const followsTheTheme = Effect.fn("followsTheTheme")(function* followsTheThemeCase() {
  const host = yield* PanelHost;
  const fake = yield* FakeHost;
  const changed = yield* Effect.forkChild(firstOf(Stream.filter(host.context, ({ theme }) => theme === "dark")));

  yield* fake.changeContext({ theme: "dark" });

  // A change carries only what changed, so the locale from ui/initialize stays.
  const context = yield* Fiber.join(changed);

  expect(context).toStrictEqual({ locale: "en-US", theme: "dark" });
});

const failsWhenRefused = Effect.fn("failsWhenRefused")(function* failsWhenRefusedCase() {
  const failure = yield* Effect.flip(Layer.build(panelOver({ ...opened, refuses: true })));

  expect(failure).toStrictEqual(HostHandshakeError.make({ message: "MCP Apps are not supported" }));
}, Effect.scoped);

describe("a panel talking to its host", () => {
  it.layer(panelOver(opened))("after the handshake", (connected) => {
    connected.effect("sends ui/initialize, then announces it is initialized", handshakes);
    connected.effect("receives the opening tool call's input and result, decoded", receivesTheOpeningCall);
    connected.effect("deposits through the host and reads the new balance", depositsThroughTheHost);
    connected.effect("gets InsufficientFunds as a typed failure for an overdraft", refusesAnOverdraft);
    connected.effect("follows the host's theme change", followsTheTheme);
  });

  it.effect("fails with HostHandshakeError when the host refuses ui/initialize", failsWhenRefused);
});
