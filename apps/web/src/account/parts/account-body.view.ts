import { create } from "@stylexjs/stylex";
import { Function as Fn, Option } from "effect";
import { inertHtml as ih } from "foldkit/html";
import type { Html, HtmlBuilder } from "foldkit/html";

import { styleAttributes } from "@repo/ui/style";
import { fontWeight, space } from "@repo/ui/tokens.stylex";

import type { Message } from "#src/account/account.message.js";
import type { AccountState, Model } from "#src/account/account.model.js";
import { formatCents } from "#src/account/money.pure.js";
import { amountField } from "#src/account/parts/amount.view.js";
import { noticeAlert } from "#src/account/parts/notice.view.js";

const styles = create({
  balance: {
    fontSize: "2.25rem",
    fontVariantNumeric: "tabular-nums",
    fontWeight: fontWeight.semibold,
    letterSpacing: "-0.02em",
    lineHeight: "2.5rem",
    margin: 0,
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: space.xxl,
  },
});

const balanceAttributes = [ih.AriaLive("polite"), ih.DataAttribute("balance", ""), ...styleAttributes(styles.balance)];

const accountBodyArity = 3;

const accountBody: {
  (state: AccountState, html: HtmlBuilder<Message>): (model: Model) => Html;
  (model: Model, state: AccountState, html: HtmlBuilder<Message>): Html;
} = Fn.dual(accountBodyArity, (model: Model, state: AccountState, html: HtmlBuilder<Message>): Html => {
  const notice = Option.toArray(Option.map(model.notice, noticeAlert(html)));
  const balance = html.p(balanceAttributes, [formatCents(state.balance)]);

  return html.div(styleAttributes(styles.body), [balance, amountField(model, html), ...notice]);
});

export { accountBody };
