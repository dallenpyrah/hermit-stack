import { view as buttonPrimitive } from "@foldkit/ui/button";
import type { ViewConfig as ButtonPrimitiveConfig } from "@foldkit/ui/button";
import { create } from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { Function as Fn, Option, Schema, pipe } from "effect";
import { inertHtml as ih } from "foldkit/html";
import type { Attribute, ChildAttribute, Html, HtmlBuilder } from "foldkit/html";

import { shared, styleAttributes } from "#src/style/style.view.js";
import type { Content } from "#src/style/style.view.js";
import {
  colors,
  control,
  font,
  fontSize,
  fontWeight,
  lineHeight,
  motion,
  radius,
  shadow,
  space,
} from "#src/tokens/tokens.stylex.js";

// Each variant is named for the color token it paints with, except the three that paint no fill.
const ButtonVariant = Schema.Literals(["primary", "secondary", "destructive", "outline", "ghost", "link"]);

type ButtonVariant = typeof ButtonVariant.Type;

const ButtonSize = Schema.Literals(["sm", "md", "lg"]);

type ButtonSize = typeof ButtonSize.Type;

type ButtonOptions<Message> = Omit<ButtonPrimitiveConfig<Message>, "toView"> &
  Readonly<{
    // Extra attributes for the button element, such as a dialog's close attributes.
    attributes?: readonly (Attribute<Message> | ChildAttribute)[];
    content: Content;
    // A square button that shows only an icon. The label becomes its accessible name, so it cannot be left out.
    iconOnly?: Readonly<{ label: string }>;
    size?: ButtonSize;
    style?: StyleXStyles;
    variant?: ButtonVariant;
  }>;

const styles = create({
  base: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: "1px",
    boxSizing: "border-box",
    cursor: "pointer",
    display: "inline-flex",
    flexShrink: 0,
    fontFamily: font.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    gap: space.md,
    justifyContent: "center",
    lineHeight: lineHeight.sm,
    margin: 0,
    textDecorationLine: "none",
    transitionDuration: motion.fast,
    transitionProperty: "background-color, border-color, color",
    transitionTimingFunction: motion.easing,
    userSelect: "none",
    whiteSpace: "nowrap",
  },
  disabled: {
    cursor: "not-allowed",
    opacity: 0.5,
  },
});

const variants = create({
  destructive: {
    backgroundColor: {
      ":hover": `color-mix(in oklab, ${colors.destructive} 90%, ${colors.background})`,
      default: colors.destructive,
    },
    boxShadow: shadow.xs,
    color: colors.destructiveForeground,
  },
  ghost: {
    backgroundColor: { ":hover": colors.accent, default: "transparent" },
    color: { ":hover": colors.accentForeground, default: colors.foreground },
  },
  link: {
    backgroundColor: "transparent",
    color: colors.primary,
    // An underline at rest keeps a link told apart from a ghost button without relying on hover.
    textDecorationColor: {
      ":hover": "currentColor",
      default: "color-mix(in oklab, currentColor 40%, transparent)",
    },
    textDecorationLine: "underline",
    textDecorationThickness: "1px",
    textUnderlineOffset: "4px",
  },
  outline: {
    backgroundColor: { ":hover": colors.accent, default: colors.background },
    borderColor: colors.input,
    boxShadow: shadow.xs,
    color: { ":hover": colors.accentForeground, default: colors.foreground },
  },
  primary: {
    backgroundColor: {
      ":hover": `color-mix(in oklab, ${colors.primary} 88%, ${colors.background})`,
      default: colors.primary,
    },
    boxShadow: shadow.xs,
    color: colors.primaryForeground,
  },
  secondary: {
    backgroundColor: {
      ":hover": `color-mix(in oklab, ${colors.secondary} 92%, ${colors.foreground})`,
      default: colors.secondary,
    },
    boxShadow: shadow.xs,
    color: colors.secondaryForeground,
  },
});

const sizes = create({
  lg: { height: control.lg, paddingInline: space.xxl },
  md: { height: control.md, paddingInline: space.xl },
  sm: { gap: space.sm, height: control.sm, paddingInline: space.lg },
});

const squares = create({
  lg: { paddingInline: 0, width: control.lg },
  md: { paddingInline: 0, width: control.md },
  sm: { paddingInline: 0, width: control.sm },
});

const render = <Message>(config: ButtonOptions<Message>, html: HtmlBuilder<Message>): Html => {
  const { attributes = [], content, iconOnly, size = "md", style, variant = "primary", ...primitive } = config;
  const maybeIconOnly = Option.fromNullishOr(iconOnly);

  return buttonPrimitive(
    {
      ...primitive,
      toView: ({ button }) =>
        html.button(
          [
            ...button,
            ...pipe(
              maybeIconOnly,
              Option.map(({ label }) => ih.AriaLabel(label)),
              Option.toArray,
            ),
            ...attributes,
            ih.DataAttribute("variant", variant),
            ih.DataAttribute("size", size),
            ...styleAttributes(
              styles.base,
              variants[variant],
              sizes[size],
              Option.isSome(maybeIconOnly) && squares[size],
              shared.focusRing,
              config.isDisabled === true && styles.disabled,
              style,
            ),
          ],
          content,
        ),
    },
    html,
  );
};

const buttonArity = 2;

// FoldKit's headless Button supplies the type, the click handler and a disabled state that keeps the button
// Focusable (aria-disabled) so a screen reader still finds it; this adds the look.
const button: {
  <Message>(html: HtmlBuilder<Message>): (config: ButtonOptions<Message>) => Html;
  <Message>(config: ButtonOptions<Message>, html: HtmlBuilder<Message>): Html;
} = Fn.dual(buttonArity, render);

export { type ButtonOptions, ButtonSize, ButtonVariant, button };
