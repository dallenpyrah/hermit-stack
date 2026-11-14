import { create } from "@stylexjs/stylex";
import { Option, pipe } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { button } from "@repo/ui/button";
import type { ButtonVariant } from "@repo/ui/button";
import type { Content } from "@repo/ui/style";
import { styleAttributes } from "@repo/ui/style";
import { space } from "@repo/ui/tokens.stylex";

import { Message } from "#src/account/account.message.js";
import type { Model, Movement } from "#src/account/account.model.js";
import { amountField } from "#src/account/view/amount.view.js";
import { noticeView } from "#src/account/view/notice.view.js";

const styles = create({
  actions: {
    display: "flex",
    gap: space.md,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: space.xl,
    margin: 0,
  },
});

type Context = Readonly<{ html: HtmlBuilder<Message>; model: Model }>;

const moveNames: Readonly<Record<Movement, string>> = { deposit: "Deposit", withdraw: "Withdraw" };

const savingNames: Readonly<Record<Movement, string>> = { deposit: "Depositing…", withdraw: "Withdrawing…" };

const moveVariants: Readonly<Record<Movement, ButtonVariant>> = { deposit: "primary", withdraw: "outline" };

// Both buttons wait while either movement is in flight, so the ledger never sees two at once from this panel.
const moveButton = ({ html, model }: Context, kind: Movement): Html => {
  const inFlight = Option.filter(model.saving, (saving) => saving === kind);
  const name = Option.match(inFlight, { onNone: () => moveNames[kind], onSome: () => savingNames[kind] });

  return button(
    {
      content: [name],
      isDisabled: Option.isSome(model.saving),
      onClick: Message.ClickedMove({ kind }),
      variant: moveVariants[kind],
    },
    html,
  );
};

// The form submits on Enter as a deposit, so the keyboard reaches one without leaving the field.
const movement = (context: Context): Content => {
  const { html, model } = context;
  const buttons = [moveButton(context, "deposit"), moveButton(context, "withdraw")];
  const actions = html.div(styleAttributes(styles.actions), buttons);
  const notice = pipe(model.notice, Option.map(noticeView(html)), Option.toArray);

  return [
    html.form(
      [html.OnSubmit(Message.ClickedMove({ kind: "deposit" })), ...styleAttributes(styles.form)],
      [amountField(context), actions],
    ),
    ...notice,
  ];
};

export { movement };
