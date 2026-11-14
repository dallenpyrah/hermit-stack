import { create } from "@stylexjs/stylex";
import { Function as Fn, Option } from "effect";
import { inertHtml as ih } from "foldkit/html";
import type { Document, HtmlBuilder } from "foldkit/html";

import { styleAttributes } from "@repo/ui/style";
import { themeStyles } from "@repo/ui/theme";
import { space } from "@repo/ui/tokens.stylex";

import type { Message } from "#src/account/account.message.js";
import type { Model } from "#src/account/account.model.js";
import { formatCents } from "#src/account/money.pure.js";
import { accountCard, missingCard } from "#src/account/parts/account-card.view.js";

const styles = create({
  page: {
    alignItems: "flex-start",
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "center",
    minHeight: "100vh",
    padding: space.xxxl,
  },
});

const titleOf = (model: Model): string =>
  Option.match(model.account.state, {
    onNone: () => `No account ${model.accountId}`,
    onSome: (state) => `${formatCents(state.balance)} · ${state.owner ?? model.accountId}`,
  });

const viewArity = 2;

const view: {
  (html: HtmlBuilder<Message>): (model: Model) => Document;
  (model: Model, html: HtmlBuilder<Message>): Document;
} = Fn.dual(viewArity, (model: Model, html: HtmlBuilder<Message>): Document => {
  const themed = styleAttributes(...themeStyles(model.theme), styles.page);

  const content = Option.match(model.account.state, {
    onNone: () => missingCard(model, html),
    onSome: (state) => accountCard(model, state, html),
  });

  return { body: html.main([ih.DataAttribute("theme", model.theme), ...themed], [content]), title: titleOf(model) };
});

export { view };
