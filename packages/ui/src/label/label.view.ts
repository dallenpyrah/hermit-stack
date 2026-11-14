import { create } from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { Function as Fn } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { styleAttributes } from "#src/style/style.view.js";
import type { Content } from "#src/style/style.view.js";
import { colors, font, fontSize, fontWeight, lineHeight, space } from "#src/tokens/tokens.stylex.js";

type LabelOptions = Readonly<{
  content: Content;
  fieldId: string;
  isDisabled?: boolean;
  style?: StyleXStyles;
}>;

const styles = create({
  base: {
    alignItems: "center",
    color: colors.foreground,
    display: "flex",
    fontFamily: font.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    gap: space.md,
    lineHeight: lineHeight.none,
    userSelect: "none",
  },
  disabled: {
    cursor: "not-allowed",
    opacity: 0.5,
  },
});

const render = <Message>(config: LabelOptions, html: HtmlBuilder<Message>): Html =>
  html.label(
    [
      html.For(config.fieldId),
      ...styleAttributes(styles.base, config.isDisabled === true && styles.disabled, config.style),
    ],
    config.content,
  );

const labelArity = 2;

const label: {
  <Message>(html: HtmlBuilder<Message>): (config: LabelOptions) => Html;
  <Message>(config: LabelOptions, html: HtmlBuilder<Message>): Html;
} = Fn.dual(labelArity, render);

export { type LabelOptions, label };
