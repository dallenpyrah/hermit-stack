import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { badge } from "@repo/ui/badge";
import { card } from "@repo/ui/card";

import type { Message } from "#src/account/account.message.js";
import { Account } from "#src/account/account.model.js";
import type { AccountStatus, Model } from "#src/account/account.model.js";
import { balanceBody } from "#src/account/view/balance.view.js";
import { movement } from "#src/account/view/movement.view.js";
import { refused } from "#src/account/view/notice.view.js";

type Context = Readonly<{ html: HtmlBuilder<Message>; model: Model }>;

type Loaded = Extract<Account, Readonly<{ _tag: "Loaded" }>>;

const statusNames: Readonly<Record<AccountStatus, string>> = { closed: "Closed", open: "Open", unopened: "Not opened" };

const loadedCard = (context: Context, loaded: Loaded): Html => {
  const { html, model } = context;
  const owner = Option.match(loaded.owner, { onNone: () => "No owner", onSome: (name) => `Owned by ${name}` });
  const isOpen = Option.liftPredicate(loaded.status, (status) => status === "open");
  const below = Option.match(isOpen, { onNone: () => [], onSome: () => movement(context) });

  return card(
    {
      action: [badge({ content: [statusNames[loaded.status]], variant: "outline" }, html)],
      body: [balanceBody({ balance: loaded.balance, below, html })],
      description: [owner],
      title: [Option.getOrElse(model.key, () => "Account")],
    },
    html,
  );
};

const accountCard = (context: Context): Html =>
  Account.match(context.model.account, {
    Loaded: (loaded) => loadedCard(context, loaded),
    Unavailable: ({ reason }) => refused({ reason, title: "The account could not be read" }, context.html),
    Waiting: () => card({ description: ["Waiting for the ledger's answer."], title: ["Account"] }, context.html),
  });

export { accountCard };
