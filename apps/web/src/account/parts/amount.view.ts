import { create } from "@stylexjs/stylex";
import { Function as Fn, Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { input } from "@repo/ui/input";
import { label } from "@repo/ui/label";
import { styleAttributes } from "@repo/ui/style";
import { space } from "@repo/ui/tokens.stylex";

import { Message } from "#src/account/account.message.js";
import type { Model } from "#src/account/account.model.js";

const amountFieldId = "amount";

const styles = create({
  amount: {
    display: "flex",
    flexDirection: "column",
    gap: space.md,
  },
});

const isInvalid = (model: Model): boolean => Option.exists(model.notice, ({ _tag }) => _tag === "InvalidAmount");

const amountFieldArity = 2;

const amountField: {
  (html: HtmlBuilder<Message>): (model: Model) => Html;
  (model: Model, html: HtmlBuilder<Message>): Html;
} = Fn.dual(amountFieldArity, (model: Model, html: HtmlBuilder<Message>): Html => {
  const field = input(
    {
      id: amountFieldId,
      isInvalid: isInvalid(model),
      onInput: (value) => Message.ChangedAmount({ value }),
      placeholder: "25.00",
      type: "text",
      value: model.amount,
    },
    html,
  );

  return html.div(styleAttributes(styles.amount), [
    label({ content: ["Amount (USD)"], fieldId: amountFieldId }, html),
    field,
  ]);
});

export { amountField };
