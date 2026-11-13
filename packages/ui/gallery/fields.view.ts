import { create } from "@stylexjs/stylex";
import type { Html, HtmlBuilder } from "foldkit/html";

import { input } from "#src/input/input.view.js";
import { label } from "#src/label/label.view.js";
import type { Content } from "#src/style/style.view.js";
import { styleAttributes } from "#src/style/style.view.js";
import { colors, fontSize, lineHeight, space } from "#src/tokens/tokens.stylex.js";

import { Message } from "./gallery.message.js";
import type { Side } from "./gallery.model.js";

const styles = create({
  error: {
    color: colors.destructive,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    margin: 0,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: space.md,
  },
  fields: {
    display: "grid",
    gap: space.xl,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  hint: {
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    margin: 0,
  },
});

const emailField = (side: Side, email: string, html: HtmlBuilder<Message>): Html => {
  const id = `${side}-email`;

  const field = input(
    {
      hasDescription: true,
      id,
      onInput: (value) => Message.ChangedEmail({ value }),
      placeholder: "you@example.com",
      type: "email",
      value: email,
    },
    html,
  );

  const hint = html.p([html.Id(`${id}-description`), ...styleAttributes(styles.hint)], ["Used for sign-in only."]);

  return html.div(styleAttributes(styles.field), [label({ content: ["Email"], fieldId: id }, html), field, hint]);
};

const invalidField = (side: Side, html: HtmlBuilder<Message>): Html => {
  const id = `${side}-handle`;
  const field = input({ hasDescription: true, id, isInvalid: true, value: "ada lovelace" }, html);
  const error = html.p([html.Id(`${id}-description`), ...styleAttributes(styles.error)], ["No spaces allowed."]);

  return html.div(styleAttributes(styles.field), [label({ content: ["Handle"], fieldId: id }, html), field, error]);
};

const disabledField = (side: Side, html: HtmlBuilder<Message>): Html => {
  const id = `${side}-team`;
  const field = input({ id, isDisabled: true, value: "Research" }, html);

  return html.div(styleAttributes(styles.field), [
    label({ content: ["Team"], fieldId: id, isDisabled: true }, html),
    field,
  ]);
};

const readOnlyField = (side: Side, html: HtmlBuilder<Message>): Html => {
  const id = `${side}-plan`;
  const field = input({ id, isReadOnly: true, value: "Pro, billed monthly" }, html);

  return html.div(styleAttributes(styles.field), [label({ content: ["Plan"], fieldId: id }, html), field]);
};

type FieldsContext = Readonly<{ email: string; html: HtmlBuilder<Message>; side: Side }>;

const fields = ({ email, html, side }: FieldsContext): Content => [
  html.div(styleAttributes(styles.fields), [
    emailField(side, email, html),
    invalidField(side, html),
    disabledField(side, html),
    readOnlyField(side, html),
  ]),
];

export { fields };
