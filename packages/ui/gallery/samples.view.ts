import { create } from "@stylexjs/stylex";
import { Array as Arr } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { badge, BadgeVariant } from "#src/badge/badge.view.js";
import { button, ButtonSize, ButtonVariant } from "#src/button/button.view.js";
import { card } from "#src/card/card.view.js";
import type { Content } from "#src/style/style.view.js";
import { styleAttributes } from "#src/style/style.view.js";
import { colors, fontSize, lineHeight, space } from "#src/tokens/tokens.stylex.js";

import type { Message } from "./gallery.message.js";

const styles = create({
  body: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    margin: 0,
  },
  row: {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    gap: space.md,
  },
  rowName: {
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    width: "5.5rem",
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: space.lg,
  },
});

const plusIcon = (html: HtmlBuilder<Message>): Html =>
  html.svg(
    [
      html.AriaHidden(true),
      html.Fill("none"),
      html.Height("16"),
      html.Stroke("currentColor"),
      html.StrokeLinecap("round"),
      html.StrokeWidth("2"),
      html.ViewBox("0 0 16 16"),
      html.Width("16"),
    ],
    [html.path([html.D("M8 3v10M3 8h10")])],
  );

const buttonRow = (variant: ButtonVariant, html: HtmlBuilder<Message>): Html => {
  const sized = Arr.map(ButtonSize.literals, (size) => button({ content: ["Button"], size, variant }, html));

  const icons = Arr.map(ButtonSize.literals, (size) =>
    button({ content: [plusIcon(html)], iconOnly: { label: `Add, ${size}` }, size, variant }, html),
  );

  const disabled = button({ content: ["Disabled"], isDisabled: true, variant }, html);

  return html.div(styleAttributes(styles.row), [
    html.span(styleAttributes(styles.rowName), [variant]),
    ...sized,
    ...icons,
    disabled,
  ]);
};

const buttons = (html: HtmlBuilder<Message>): Content => [
  html.div(
    styleAttributes(styles.stack),
    Arr.map(ButtonVariant.literals, (variant) => buttonRow(variant, html)),
  ),
];

const badges = (html: HtmlBuilder<Message>): Content => [
  html.div(
    styleAttributes(styles.row),
    Arr.map(BadgeVariant.literals, (variant) => badge({ content: [variant], variant }, html)),
  ),
];

const cards = (html: HtmlBuilder<Message>): Content => {
  const action = button({ content: ["Manage"], size: "sm", variant: "outline" }, html);

  const footer = [
    button({ content: ["Upgrade"], size: "sm" }, html),
    button({ content: ["Compare plans"], size: "sm", variant: "ghost" }, html),
  ];

  const body = [html.p(styleAttributes(styles.body), ["Next payment of $24 is due on 1 December."])];
  const full = card({ action: [action], body, description: ["Billed monthly"], footer, title: ["Pro plan"] }, html);
  const plain = card({ description: ["A card with only a title and a description."], title: ["Notes"] }, html);

  return [html.div(styleAttributes(styles.stack), [full, plain])];
};

export { badges, buttons, cards };
