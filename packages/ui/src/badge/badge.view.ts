import { create } from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { Function as Fn, Schema } from "effect";
import { inertHtml as ih } from "foldkit/html";
import type { Html, HtmlBuilder } from "foldkit/html";

import { styleAttributes } from "#src/style/style.view.js";
import type { Content } from "#src/style/style.view.js";
import { colors, font, fontSize, fontWeight, lineHeight, radius, space } from "#src/tokens/tokens.stylex.js";

// Named, like Button's, for the color token each paints with; outline paints only a border.
const BadgeVariant = Schema.Literals(["primary", "secondary", "destructive", "outline"]);

type BadgeVariant = typeof BadgeVariant.Type;

type BadgeOptions = Readonly<{
  content: Content;
  style?: StyleXStyles;
  variant?: BadgeVariant;
}>;

const styles = create({
  base: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: "1px",
    boxSizing: "border-box",
    display: "inline-flex",
    flexShrink: 0,
    fontFamily: font.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    gap: space.xs,
    lineHeight: lineHeight.xs,
    paddingBlock: space.xxs,
    paddingInline: space.md,
    whiteSpace: "nowrap",
  },
});

const variants = create({
  destructive: { backgroundColor: colors.destructive, color: colors.destructiveForeground },
  outline: { backgroundColor: "transparent", borderColor: colors.border, color: colors.foreground },
  primary: { backgroundColor: colors.primary, color: colors.primaryForeground },
  secondary: { backgroundColor: colors.secondary, color: colors.secondaryForeground },
});

const render = <Message>(config: BadgeOptions, html: HtmlBuilder<Message>): Html => {
  const { variant = "primary" } = config;

  return html.span(
    [ih.DataAttribute("variant", variant), ...styleAttributes(styles.base, variants[variant], config.style)],
    config.content,
  );
};

const badgeArity = 2;

// A short status or count. It is text only, so it takes no handlers; wrap it in a Button or link to make it act.
const badge: {
  <Message>(html: HtmlBuilder<Message>): (config: BadgeOptions) => Html;
  <Message>(config: BadgeOptions, html: HtmlBuilder<Message>): Html;
} = Fn.dual(badgeArity, render);

export { type BadgeOptions, BadgeVariant, badge };
