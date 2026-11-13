import { view as inputPrimitive } from "@foldkit/ui/input";
import type { ViewConfig as InputPrimitiveConfig } from "@foldkit/ui/input";
import { create } from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { Function as Fn } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { shared, styleAttributes } from "#src/style/style.view.js";
import {
  colors,
  control,
  font,
  fontSize,
  lineHeight,
  motion,
  radius,
  shadow,
  space,
} from "#src/tokens/tokens.stylex.js";

type InputOptions<Message> = Omit<InputPrimitiveConfig<Message>, "toView"> & Readonly<{ style?: StyleXStyles }>;

const styles = create({
  base: {
    "::placeholder": { color: colors.mutedForeground },
    backgroundColor: colors.background,
    borderColor: colors.input,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: shadow.xs,
    boxSizing: "border-box",
    color: colors.foreground,
    fontFamily: font.sans,
    fontSize: fontSize.sm,
    height: control.md,
    lineHeight: lineHeight.sm,
    margin: 0,
    minWidth: 0,
    paddingBlock: space.xs,
    paddingInline: space.lg,
    transitionDuration: motion.fast,
    transitionProperty: "border-color",
    transitionTimingFunction: motion.easing,
    width: "100%",
  },
  disabled: {
    cursor: "not-allowed",
    opacity: 0.5,
  },
  invalid: {
    borderColor: colors.destructive,
    outlineColor: colors.destructive,
  },
  readOnly: {
    backgroundColor: colors.muted,
  },
});

const render = <Message>(config: InputOptions<Message>, html: HtmlBuilder<Message>): Html => {
  const { style, ...primitive } = config;

  return inputPrimitive(
    {
      ...primitive,
      toView: ({ input }) =>
        html.input([
          ...input,
          ...styleAttributes(
            styles.base,
            shared.focusRing,
            config.isReadOnly === true && styles.readOnly,
            config.isInvalid === true && styles.invalid,
            config.isDisabled === true && styles.disabled,
            style,
          ),
        ]),
    },
    html,
  );
};

const inputArity = 2;

// The text field alone. FoldKit's headless Input sets the id, aria-invalid, aria-describedby and the disabled and
// Read-only states; name the field with Label.view given the same id.
const input: {
  <Message>(html: HtmlBuilder<Message>): (config: InputOptions<Message>) => Html;
  <Message>(config: InputOptions<Message>, html: HtmlBuilder<Message>): Html;
} = Fn.dual(inputArity, render);

export { type InputOptions, input };
