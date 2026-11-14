import { create } from "@stylexjs/stylex";
import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { input } from "@repo/ui/input";
import { label } from "@repo/ui/label";
import { styleAttributes } from "@repo/ui/style";
import { colors, fontSize, lineHeight, space } from "@repo/ui/tokens.stylex";

import { Message } from "#src/account/account.message.js";
import { Notice } from "#src/account/account.model.js";
import type { Model } from "#src/account/account.model.js";

const styles = create({
  field: {
    display: "flex",
    flexDirection: "column",
    gap: space.md,
  },
  hint: {
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    margin: 0,
  },
});

const amountId = "account-amount";

const amountField = ({ html, model }: Readonly<{ html: HtmlBuilder<Message>; model: Model }>): Html => {
  const field = input(
    {
      hasDescription: true,
      id: amountId,
      isInvalid: Option.exists(model.notice, Notice.guards.InvalidAmount),
      onInput: (value) => Message.ChangedAmount({ value }),
      placeholder: "0.00",
      value: model.amount,
    },
    html,
  );

  const hint = html.p([html.Id(`${amountId}-description`), ...styleAttributes(styles.hint)], ["In dollars."]);

  return html.div(styleAttributes(styles.field), [
    label({ content: ["Amount"], fieldId: amountId }, html),
    field,
    hint,
  ]);
};

export { amountField };
