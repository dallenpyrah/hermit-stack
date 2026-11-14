import { Function as Fn, Match } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { alert } from "@repo/ui/alert";

import type { Message } from "#src/account/account.message.js";
import type { Notice } from "#src/account/account.model.js";
import { formatCents } from "#src/account/money.pure.js";

const noticeAlertArity = 2;

const noticeAlert: {
  (html: HtmlBuilder<Message>): (notice: Notice) => Html;
  (notice: Notice, html: HtmlBuilder<Message>): Html;
} = Fn.dual(noticeAlertArity, (notice: Notice, html: HtmlBuilder<Message>): Html =>
  Match.valueTags(notice, {
    AlreadyOpen: () => alert({ title: ["This account is already open."], variant: "destructive" }, html),
    BalanceNotZero: ({ balance }) =>
      alert(
        { description: [`It still holds ${formatCents(balance)}.`], title: ["Not empty"], variant: "destructive" },
        html,
      ),
    Denied: () => alert({ title: ["You are not allowed to do that."], variant: "destructive" }, html),
    InsufficientFunds: ({ balance, requested }) =>
      alert(
        {
          description: [`The balance is ${formatCents(balance)}; you asked for ${formatCents(requested)}.`],
          title: ["Not enough money"],
          variant: "destructive",
        },
        html,
      ),
    InvalidAmount: () =>
      alert(
        {
          description: ["Enter dollars and cents, such as 25.00."],
          title: ["Enter an amount"],
          variant: "destructive",
        },
        html,
      ),
    NotOpen: () => alert({ title: ["This account is not open."], variant: "destructive" }, html),
    Unconfirmed: () =>
      alert(
        { description: ["The balance above shows whether it went through."], title: ["No reply from the ledger"] },
        html,
      ),
  }),
);

export { noticeAlert };
