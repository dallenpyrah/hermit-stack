import { Function as Fn, Option } from "effect";
import type { Return } from "foldkit/update";

import type { PanelHost } from "@repo/mcp-app/panel-host";

import { Move } from "#src/account/account.command.js";
import { Message } from "#src/account/account.message.js";
import { Account, Notice } from "#src/account/account.model.js";
import type { Model, Movement } from "#src/account/account.model.js";
import { parseCents } from "#src/account/money.pure.js";

type Next = Return<Model, Message, PanelHost>;

const init = (): Next => ({
  model: {
    account: Account.Waiting(),
    amount: "",
    key: Option.none(),
    notice: Option.none(),
    saving: Option.none(),
    theme: "light",
  },
});

// A deposit or withdrawal starts only for a known, open account, with no other one in flight, and a valid amount.
const move = (model: Model, kind: Movement): Next => {
  const isOpen = Account.matchOrElse(model.account, { Loaded: ({ status }) => status === "open" }, () => false);
  const target = Option.filter(model.key, () => isOpen && Option.isNone(model.saving));

  return Option.match(target, {
    onNone: () => ({ model }),
    onSome: (key) =>
      Option.match(parseCents(model.amount), {
        onNone: () => ({ model: { ...model, notice: Option.some(Notice.InvalidAmount()) } }),
        onSome: (amount) => ({
          commands: [Move({ amount, key, kind })],
          model: { ...model, notice: Option.none(), saving: Option.some(kind) },
        }),
      }),
  });
};

const settled = (model: Model, notice: Notice): Model => ({
  ...model,
  notice: Option.some(notice),
  saving: Option.none(),
});

const withBalance = (account: Account, balance: number): Account =>
  Account.matchOrElse(
    account,
    { Loaded: (loaded): Account => Account.Loaded({ ...loaded, balance }) },
    (other): Account => other,
  );

const updateArity = 2;

const update: {
  (message: Message): (model: Model) => Next;
  (model: Model, message: Message): Next;
} = Fn.dual(updateArity, (model: Model, message: Message): Next =>
  Message.match(message, {
    ChangedAmount: ({ value }): Next => ({ model: { ...model, amount: value } }),
    ChangedTheme: ({ theme }): Next => ({ model: { ...model, theme } }),
    ClickedMove: ({ kind }): Next => move(model, kind),
    FailedMove: ({ reason }): Next => ({ model: settled(model, Notice.Failed({ reason })) }),
    FailedToLoad: ({ reason }): Next => ({ model: { ...model, account: Account.Unavailable({ reason }) } }),
    GotAccountKey: ({ key }): Next => ({ model: { ...model, key: Option.some(key) } }),
    GotBalance: ({ balance, owner, status }): Next => ({
      model: { ...model, account: Account.Loaded({ balance, owner, status }) },
    }),
    Moved: ({ amount, balance, kind }): Next => ({
      model: {
        ...settled(model, Notice.Moved({ amount, kind })),
        account: withBalance(model.account, balance),
        amount: "",
      },
    }),
    RefusedMove: ({ reason }): Next => ({ model: settled(model, Notice.Refused({ reason })) }),
  }),
);

export { init, update };
