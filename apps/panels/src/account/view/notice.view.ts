import { Function as Fn } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { alert } from "@repo/ui/alert";

import type { Message } from "#src/account/account.message.js";
import { Notice } from "#src/account/account.model.js";
import type { Movement } from "#src/account/account.model.js";
import { formatCents } from "#src/account/money.pure.js";

type Problem = Readonly<{ reason: string; title: string }>;

const movedNames: Readonly<Record<Movement, string>> = { deposit: "Deposited", withdraw: "Withdrew" };

const refusedArity = 2;

// A failure the person should read before they try again.
const refused: {
  <AnyMessage>(html: HtmlBuilder<AnyMessage>): (problem: Problem) => Html;
  <AnyMessage>(problem: Problem, html: HtmlBuilder<AnyMessage>): Html;
} = Fn.dual(refusedArity, <AnyMessage>(problem: Problem, html: HtmlBuilder<AnyMessage>): Html =>
  alert({ description: [problem.reason], title: [problem.title], variant: "destructive" }, html),
);

const invalidAmount: Problem = { reason: "Enter dollars and cents, such as 12.50.", title: "That is not an amount" };

const noticeArity = 2;

// The outcome of the person's last deposit or withdrawal.
const noticeView: {
  (html: HtmlBuilder<Message>): (notice: Notice) => Html;
  (notice: Notice, html: HtmlBuilder<Message>): Html;
} = Fn.dual(noticeArity, (notice: Notice, html: HtmlBuilder<Message>): Html =>
  Notice.match(notice, {
    Failed: ({ reason }) => refused({ reason, title: "The ledger did not answer" }, html),
    InvalidAmount: () => refused(invalidAmount, html),
    Moved: ({ amount, kind }) => alert({ title: [`${movedNames[kind]} ${formatCents(amount)}`] }, html),
    Refused: ({ reason }) => refused({ reason, title: "Refused" }, html),
  }),
);

export { noticeView, refused };
