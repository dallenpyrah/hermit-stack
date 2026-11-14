import { create } from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { Function as Fn, Option, pipe } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { styleAttributes } from "#src/style/style.view.js";
import type { Content } from "#src/style/style.view.js";
import { colors, font, fontSize, fontWeight, lineHeight, radius, shadow, space } from "#src/tokens/tokens.stylex.js";

type CardOptions = Readonly<{
  action?: Content;
  body?: Content;
  description?: Content;
  footer?: Content;
  style?: StyleXStyles;
  title: Content;
}>;

const styles = create({
  action: {
    flexShrink: 0,
  },
  body: {
    paddingInline: space.xxl,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: shadow.sm,
    boxSizing: "border-box",
    color: colors.cardForeground,
    display: "flex",
    flexDirection: "column",
    fontFamily: font.sans,
    gap: space.xxl,
    margin: 0,
    paddingBlock: space.xxl,
  },
  description: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    margin: 0,
  },
  footer: {
    alignItems: "center",
    display: "flex",
    gap: space.md,
    paddingInline: space.xxl,
  },
  header: {
    alignItems: "flex-start",
    display: "flex",
    gap: space.xl,
    paddingInline: space.xxl,
  },
  heading: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    gap: space.sm,
    minWidth: 0,
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.base,
    margin: 0,
  },
});

const optional = (maybeContent: Content | undefined, toHtml: (content: Content) => Html): readonly Html[] =>
  pipe(Option.fromNullishOr(maybeContent), Option.map(toHtml), Option.toArray);

const render = <Message>(config: CardOptions, html: HtmlBuilder<Message>): Html => {
  const title = html.h3(styleAttributes(styles.title), config.title);
  const description = optional(config.description, (content) => html.p(styleAttributes(styles.description), content));
  const heading = html.div(styleAttributes(styles.heading), [title, ...description]);
  const action = optional(config.action, (content) => html.div(styleAttributes(styles.action), content));
  const header = html.div(styleAttributes(styles.header), [heading, ...action]);
  const body = optional(config.body, (content) => html.div(styleAttributes(styles.body), content));
  const footer = optional(config.footer, (content) => html.div(styleAttributes(styles.footer), content));

  return html.section(styleAttributes(styles.card, config.style), [header, ...body, ...footer]);
};

const cardArity = 2;

const card: {
  <Message>(html: HtmlBuilder<Message>): (config: CardOptions) => Html;
  <Message>(config: CardOptions, html: HtmlBuilder<Message>): Html;
} = Fn.dual(cardArity, render);

export { type CardOptions, card };
