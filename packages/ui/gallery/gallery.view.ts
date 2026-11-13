import { create } from "@stylexjs/stylex";
import { Function as Fn } from "effect";
import type { Document, HtmlBuilder } from "foldkit/html";

import { shared, styleAttributes } from "#src/style/style.view.js";

import { column } from "./column.view.js";
import type { Message } from "./gallery.message.js";
import type { Model } from "./gallery.model.js";

const styles = create({
  page: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    minHeight: "100vh",
  },
});

const viewArity = 2;

const view: {
  (html: HtmlBuilder<Message>): (model: Model) => Document;
  (model: Model, html: HtmlBuilder<Message>): Document;
} = Fn.dual(viewArity, (model: Model, html: HtmlBuilder<Message>): Document => ({
  body: html.main(styleAttributes(styles.page), [
    html.h1(styleAttributes(shared.visuallyHidden), ["hermit-stack design system"]),
    column({ html, model, side: "light" }),
    column({ html, model, side: "dark" }),
  ]),
  title: "hermit-stack design system",
}));

export { view };
