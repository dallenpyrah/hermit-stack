import { create } from "@stylexjs/stylex";
import { Function as Fn, Match, Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { badge } from "@repo/ui/badge";
import type { BadgeVariant } from "@repo/ui/badge";
import { button } from "@repo/ui/button";
import { styleAttributes } from "@repo/ui/style";
import type { Content } from "@repo/ui/style";
import { fontSize, lineHeight, space } from "@repo/ui/tokens.stylex";

import { Message } from "#src/account/account.message.js";
import type { AccountState, Model } from "#src/account/account.model.js";

const styles = create({
  footer: {
    alignItems: "center",
    display: "flex",
    flexGrow: 1,
    flexWrap: "wrap",
    gap: space.md,
  },
  live: {
    marginInlineStart: "auto",
  },
  paused: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    margin: 0,
  },
});

const statuses: Readonly<Record<AccountState["status"], Readonly<{ text: string; variant: BadgeVariant }>>> = {
  closed: { text: "Closed", variant: "outline" },
  open: { text: "Open", variant: "secondary" },
  unopened: { text: "Not opened", variant: "outline" },
};

const statusBadgeArity = 2;

const statusBadge: {
  (html: HtmlBuilder<Message>): (state: AccountState) => Html;
  (state: AccountState, html: HtmlBuilder<Message>): Html;
} = Fn.dual(statusBadgeArity, (state: AccountState, html: HtmlBuilder<Message>): Html => {
  const status = statuses[state.status];

  return badge({ content: [status.text], variant: status.variant }, html);
});

const liveBadge = (html: HtmlBuilder<Message>): readonly Html[] => [
  html.span(styleAttributes(styles.live), [badge({ content: ["Live"], variant: "outline" }, html)]),
];

const pausedNotice = (html: HtmlBuilder<Message>): readonly Html[] => [
  html.p(styleAttributes(styles.live, styles.paused), ["Updates paused"]),
  button({ content: ["Reconnect"], onClick: Message.ClickedReconnect(), size: "sm", variant: "ghost" }, html),
];

const feedIndicator = (model: Model, html: HtmlBuilder<Message>): readonly Html[] =>
  Match.value(model.feed).pipe(
    Match.when("Live", () => liveBadge(html)),
    Match.when("Paused", () => pausedNotice(html)),
    Match.orElse(() => []),
  );

const controlsArity = 3;

const controls: {
  (state: AccountState, html: HtmlBuilder<Message>): (model: Model) => Content;
  (model: Model, state: AccountState, html: HtmlBuilder<Message>): Content;
} = Fn.dual(controlsArity, (model: Model, state: AccountState, html: HtmlBuilder<Message>): Content => {
  const isDisabled = Option.isSome(model.sending) || state.status !== "open";

  return [
    html.div(styleAttributes(styles.footer), [
      button({ content: ["Deposit"], isDisabled, onClick: Message.ClickedDeposit() }, html),
      button({ content: ["Withdraw"], isDisabled, onClick: Message.ClickedWithdraw(), variant: "outline" }, html),
      ...feedIndicator(model, html),
    ]),
  ];
});

export { controls, statusBadge };
