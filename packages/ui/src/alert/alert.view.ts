import { create } from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { Function as Fn, Option, Schema, pipe } from "effect";
import { inertHtml as ih } from "foldkit/html";
import type { Html, HtmlBuilder } from "foldkit/html";

import { styleAttributes } from "#src/style/style.view.js";
import type { Content } from "#src/style/style.view.js";
import { colors, font, fontSize, fontWeight, lineHeight, radius, space } from "#src/tokens/tokens.stylex.js";

const AlertVariant = Schema.Literals(["default", "destructive"]);

type AlertVariant = typeof AlertVariant.Type;

type AlertOptions = Readonly<{
  description?: Content;
  style?: StyleXStyles;
  title: Content;
  variant?: AlertVariant;
}>;

const styles = create({
  base: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: "1px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    fontFamily: font.sans,
    fontSize: fontSize.sm,
    gap: space.xs,
    lineHeight: lineHeight.sm,
    paddingBlock: space.lg,
    paddingInline: space.xl,
    width: "100%",
  },
  description: {
    margin: 0,
  },
  title: {
    fontWeight: fontWeight.medium,
    margin: 0,
  },
});

const variants = create({
  default: { backgroundColor: colors.card, color: colors.cardForeground },
  destructive: {
    backgroundColor: colors.card,
    borderColor: `color-mix(in oklab, ${colors.destructive} 50%, transparent)`,
    color: colors.destructive,
  },
});

const render = <Message>(config: AlertOptions, html: HtmlBuilder<Message>): Html => {
  const { variant = "default" } = config;
  const title = html.p(styleAttributes(styles.title), config.title);

  const description = pipe(
    Option.fromNullishOr(config.description),
    Option.map((content) => html.p(styleAttributes(styles.description), content)),
    Option.toArray,
  );

  return html.div(
    [
      ih.Role("alert"),
      ih.DataAttribute("variant", variant),
      ...styleAttributes(styles.base, variants[variant], config.style),
    ],
    [title, ...description],
  );
};

const alertArity = 2;

const alert: {
  <Message>(html: HtmlBuilder<Message>): (config: AlertOptions) => Html;
  <Message>(config: AlertOptions, html: HtmlBuilder<Message>): Html;
} = Fn.dual(alertArity, render);

export { type AlertOptions, AlertVariant, alert };
