import { create } from "@stylexjs/stylex";
import { Function as Fn } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { card } from "@repo/ui/card";

import type { Message } from "#src/account/account.message.js";
import type { AccountState, Model } from "#src/account/account.model.js";
import { accountBody } from "#src/account/parts/account-body.view.js";
import { controls, statusBadge } from "#src/account/parts/controls.view.js";

const styles = create({
  panel: {
    maxWidth: "28rem",
    width: "100%",
  },
});

const accountCardArity = 3;

const accountCard: {
  (state: AccountState, html: HtmlBuilder<Message>): (model: Model) => Html;
  (model: Model, state: AccountState, html: HtmlBuilder<Message>): Html;
} = Fn.dual(accountCardArity, (model: Model, state: AccountState, html: HtmlBuilder<Message>): Html =>
  card(
    {
      action: [statusBadge(state, html)],
      body: [accountBody(model, state, html)],
      description: [`Account ${model.accountId}`],
      footer: controls(model, state, html),
      style: styles.panel,
      title: [state.owner ?? "Unnamed account"],
    },
    html,
  ),
);

const missingCardArity = 2;

const missingCard: {
  (html: HtmlBuilder<Message>): (model: Model) => Html;
  (model: Model, html: HtmlBuilder<Message>): Html;
} = Fn.dual(missingCardArity, (model: Model, html: HtmlBuilder<Message>): Html =>
  card(
    {
      description: ["Nothing has been opened under this id."],
      style: styles.panel,
      title: [`No account ${model.accountId}`],
    },
    html,
  ),
);

export { accountCard, missingCard };
