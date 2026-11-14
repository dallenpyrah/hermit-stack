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
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: "1px",
    boxSizing: "border-box",
    color: colors.cardForeground,
    display: "flex",
    flexDirection: "column",
    fontFamily: font.sans,
    gap: space.xs,
    paddingBlock: space.lg,
    paddingInline: space.xl,
    width: "100%",
  },
  description: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    margin: 0,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.sm,
    margin: 0,
  },
});

const variants = create({
  default: {},
  destructive: {
    borderColor: `color-mix(in oklab, ${colors.destructive} 50%, ${colors.border})`,
    color: colors.destructive,
  },
});

const roles: Readonly<Record<AlertVariant, string>> = { default: "status", destructive: "alert" };

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
      ih.Role(roles[variant]),
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
