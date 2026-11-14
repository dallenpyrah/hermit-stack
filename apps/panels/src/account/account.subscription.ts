import { Effect, Function as Fn, Match, Option, Result, Stream } from "effect";
import { Subscription } from "foldkit";

import { LedgerApi } from "@repo/ledger/api";
import { PanelHost } from "@repo/mcp-app/panel-host";

import { Message } from "#src/account/account.message.js";
import type { AccountStatus, Model } from "#src/account/account.model.js";

const fromHost = <Value>(
  toStream: (host: PanelHost["Service"]) => Stream.Stream<Value>,
): Stream.Stream<Value, never, PanelHost> => Stream.unwrap(Effect.map(PanelHost, toStream));

const theme = fromHost((host) =>
  host.context.pipe(
    Stream.filterMap(({ theme: chosen }) => Result.fromNullishOr(chosen, Fn.constVoid)),
    Stream.changes,
    Stream.map((chosen) => Message.ChangedTheme({ theme: chosen })),
  ),
);

const accountKey = fromHost((host) =>
  host.toolInput(LedgerApi, "Balance.get").pipe(
    Stream.filterMap(Fn.identity),
    Stream.map(({ key }) => Message.GotAccountKey({ key })),
  ),
);

const balanceOf = (
  value: Option.Option<Readonly<{ balance: number; owner?: string; status: AccountStatus }>>,
): Message =>
  Option.match(value, {
    onNone: () => Message.GotBalance({ balance: 0, owner: Option.none(), status: "unopened" }),
    onSome: ({ balance, owner, status }) => Message.GotBalance({ balance, owner: Option.fromNullishOr(owner), status }),
  });

const balance = fromHost((host) =>
  host.toolResult(LedgerApi, "Balance.get").pipe(
    Stream.map(
      Result.match({
        onFailure: (error) =>
          Message.FailedToLoad({
            reason: Match.value(error).pipe(
              Match.tag("ToolCallError", ({ message }) => message),
              Match.orElse(() => "The ledger could not read the account."),
            ),
          }),
        onSuccess: ({ value }) => balanceOf(Option.fromNullishOr(value)),
      }),
    ),
  ),
);

const subscriptions = Subscription.make<Model, Message, PanelHost>()(() => ({
  accountKey: Subscription.persistentEntry(accountKey),
  balance: Subscription.persistentEntry(balance),
  theme: Subscription.persistentEntry(theme),
}));

export { subscriptions };
