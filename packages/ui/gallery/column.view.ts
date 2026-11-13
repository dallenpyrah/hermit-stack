import { create } from "@stylexjs/stylex";
import { inertHtml as ih } from "foldkit/html";
import type { Html, HtmlBuilder } from "foldkit/html";

import type { Content } from "#src/style/style.view.js";
import { styleAttributes } from "#src/style/style.view.js";
import { themeStyles } from "#src/theme/theme.view.js";
import { colors, fontSize, fontWeight, lineHeight, space } from "#src/tokens/tokens.stylex.js";

import { dialog } from "./dialog-sample.view.js";
import { fields } from "./fields.view.js";
import type { Message } from "./gallery.message.js";
import type { Model, Side } from "./gallery.model.js";
import { badges, buttons, cards } from "./samples.view.js";

const styles = create({
  column: {
    display: "flex",
    flexDirection: "column",
    gap: space.xxxl,
    minWidth: 0,
    padding: space.xxxl,
  },
  columnTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.xl,
    margin: 0,
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: space.xs,
  },
  intro: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    margin: 0,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: space.xl,
  },
  sectionTitle: {
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: "1px",
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.sm,
    margin: 0,
    paddingBlockEnd: space.md,
  },
});

const sideNames = { dark: "Dark", light: "Light" };

const section = (title: string, content: Content, html: HtmlBuilder<Message>): Html =>
  html.section(styleAttributes(styles.section), [html.h3(styleAttributes(styles.sectionTitle), [title]), ...content]);

type ColumnContext = Readonly<{ html: HtmlBuilder<Message>; model: Model; side: Side }>;

const column = ({ html, model, side }: ColumnContext): Html => {
  const title = html.h2(styleAttributes(styles.columnTitle), [`${sideNames[side]} theme`]);
  const intro = html.p(styleAttributes(styles.intro), ["Every hermit-stack component, in every variant and size."]);
  const header = html.header(styleAttributes(styles.header), [title, intro]);

  return html.div(
    [ih.DataAttribute("theme", side), ...styleAttributes(...themeStyles(side), styles.column)],
    [
      header,
      section("Button", buttons(html), html),
      section("Badge", badges(html), html),
      section("Input and Label", fields({ email: model.email, html, side }), html),
      section("Card", cards(html), html),
      section("Dialog", dialog({ html, model, side }), html),
    ],
  );
};

export { column };
