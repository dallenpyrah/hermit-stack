import { CommandIds } from "@alchemy.run/domain/Foldkit";
import { Array as Arr, Schema } from "effect";
import type { Option } from "effect";

import { AccountId } from "@repo/ledger/account-id";
import { LedgerApi } from "@repo/ledger/api";
import { ThemeName } from "@repo/ui/theme";

import { ledger } from "#src/account/ledger.api.js";

const AccountSnapshot = ledger.Balance.SnapshotFlags;

type AccountSnapshot = typeof AccountSnapshot.Type;

type AccountState = Option.Option.Value<AccountSnapshot["state"]>;

const Flags = Schema.Struct({
  account: Schema.Unknown,
  accountId: AccountId,
  session: Schema.String,
  theme: ThemeName,
});

type Flags = typeof Flags.Type;

const Feed = Schema.Literals(["Seeded", "Live", "Paused"]);

const Movement = Schema.Literals(["DepositMoney", "WithdrawMoney"]);

type Movement = typeof Movement.Type;

const InvalidAmount = Schema.TaggedStruct("InvalidAmount", {});

const Unconfirmed = Schema.TaggedStruct("Unconfirmed", {});

const Denied = Schema.TaggedStruct("Denied", {});

type LedgerRejection = (typeof LedgerApi.commands)[number]["rejects"][number];

const Rejection = Schema.Union(
  Arr.flatMap(LedgerApi.commands, (command): readonly LedgerRejection[] => command.rejects),
);

const Notice = Schema.Union([Rejection, InvalidAmount, Unconfirmed, Denied]);

type Notice = typeof Notice.Type;

const Model = Schema.Struct({
  account: AccountSnapshot,
  accountId: AccountId,
  amount: Schema.String,
  commandIds: CommandIds,
  feed: Feed,
  notice: Schema.Option(Notice),
  sending: Schema.Option(Schema.Struct({ commandId: Schema.String, movement: Movement })),
  theme: ThemeName,
});

type Model = typeof Model.Type;

export { AccountSnapshot, type AccountState, Denied, Flags, InvalidAmount, Model, Movement, Notice, Unconfirmed };
