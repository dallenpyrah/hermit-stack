import { create } from "@stylexjs/stylex";
import type { Html, HtmlBuilder } from "foldkit/html";

import type { Content } from "@repo/ui/style";
import { styleAttributes } from "@repo/ui/style";
import { colors, fontSize, fontWeight, lineHeight, space } from "@repo/ui/tokens.stylex";

import type { Message } from "#src/account/account.message.js";
import { formatCents } from "#src/account/money.pure.js";

const styles = create({
  body: {
    display: "flex",
    flexDirection: "column",
    gap: space.xl,
  },
  caption: {
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    margin: 0,
  },
  figure: {
    fontSize: fontSize.xxl,
    fontVariantNumeric: "tabular-nums",
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.xxl,
    margin: 0,
  },
});

type BalanceContext = Readonly<{ balance: number; below: Content; html: HtmlBuilder<Message> }>;

const balanceBody = ({ balance, below, html }: BalanceContext): Html => {
  const caption = html.p(styleAttributes(styles.caption), ["Balance"]);
  const figure = html.p([html.AriaLive("polite"), ...styleAttributes(styles.figure)], [formatCents(balance)]);

  return html.div(styleAttributes(styles.body), [html.div([], [caption, figure]), ...below]);
};

export { balanceBody };
