import { Effect, Match, Schema } from "effect";
import { Command } from "foldkit";

import { LedgerApi } from "@repo/ledger/api";
import { PanelHost } from "@repo/mcp-app/panel-host";

import { Message } from "#src/account/account.message.js";
import { Movement } from "#src/account/account.model.js";
import { formatCents } from "#src/account/money.pure.js";

const Move = Command.define("Move", {
  args: { amount: Schema.Int, key: Schema.String, kind: Movement },
  execute: ({ amount, key, kind }) =>
    Effect.flatMap(PanelHost, (host) =>
      Match.value(kind).pipe(
        Match.when("deposit", () => host.call(LedgerApi, "DepositMoney", { input: { amount }, target: key })),
        Match.when("withdraw", () => host.call(LedgerApi, "WithdrawMoney", { input: { amount }, target: key })),
        Match.exhaustive,
      ),
    ).pipe(
      Effect.map(({ reply }) => Message.Moved({ amount, balance: reply.balance, kind })),
      Effect.catchTags({
        InsufficientFunds: ({ balance, requested }) =>
          Effect.succeed(
            Message.RefusedMove({
              reason: `The balance is ${formatCents(balance)}, so ${formatCents(requested)} cannot be withdrawn.`,
            }),
          ),
        NotOpen: () => Effect.succeed(Message.RefusedMove({ reason: "The account is not open." })),
        ToolCallError: ({ message }) => Effect.succeed(Message.FailedMove({ reason: message })),
      }),
    ),
  messages: [Message.Moved, Message.RefusedMove, Message.FailedMove],
});

export { Move };
