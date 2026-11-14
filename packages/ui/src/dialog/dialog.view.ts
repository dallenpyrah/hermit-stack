import type { RenderInfo, ViewInputs } from "@foldkit/ui/dialog";
import { create } from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { Boolean as Bool, Function as Fn, Option, Predicate, pipe } from "effect";
import { inertHtml as ih } from "foldkit/html";
import type { Html, HtmlBuilder } from "foldkit/html";

import { shared, styleAttributes } from "#src/style/style.view.js";
import type { Content } from "#src/style/style.view.js";
import { colors, font, fontSize, fontWeight, lineHeight, radius, shadow, space } from "#src/tokens/tokens.stylex.js";

type CloseAttributes = RenderInfo["closeButton"];

type DialogOptions = Readonly<{
  actions?: (close: CloseAttributes) => Content;
  body?: Content;
  description?: Content;
  hasCloseButton?: boolean;
  style?: StyleXStyles;
  title: Content;
}>;

const wide = "@media (min-width: 640px)";

const styles = create({
  actions: {
    display: "flex",
    flexDirection: { default: "column-reverse", [wide]: "row" },
    gap: space.md,
    justifyContent: "flex-end",
  },
  close: {
    alignItems: "center",
    backgroundColor: { ":hover": colors.accent, default: "transparent" },
    borderRadius: radius.sm,
    borderStyle: "none",
    color: colors.mutedForeground,
    cursor: "pointer",
    display: "inline-flex",
    height: "1.75rem",
    insetBlockStart: space.lg,
    insetInlineEnd: space.lg,
    justifyContent: "center",
    padding: 0,
    position: "absolute",
    width: "1.75rem",
  },
  description: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    margin: 0,
  },
  dialog: {
    alignItems: "center",
    color: colors.foreground,
    display: "flex",
    fontFamily: font.sans,
    justifyContent: "center",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: space.md,
    paddingInlineEnd: space.xxl,
  },
  overlay: {
    backgroundColor: colors.overlay,
    inset: 0,
    position: "fixed",
  },
  panel: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: shadow.lg,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: space.xl,
    maxHeight: "calc(100% - 2rem)",
    overflowY: "auto",
    padding: space.xxl,
    position: "relative",
    width: "min(calc(100% - 2rem), 32rem)",
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.lg,
    margin: 0,
  },
});

const crossIcon = <Message>(html: HtmlBuilder<Message>): Html =>
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
    [html.path([html.D("M4 4l8 8M12 4l-8 8")])],
  );

const closeButton = <Message>(close: CloseAttributes, html: HtmlBuilder<Message>): Html =>
  html.button(
    [...close, ...styleAttributes(styles.close, shared.focusRing)],
    [crossIcon(html), html.span(styleAttributes(shared.visuallyHidden), ["Close"])],
  );

const panel = <Message>(config: DialogOptions, parts: RenderInfo, html: HtmlBuilder<Message>): Html => {
  const title = html.h2([...parts.title, ...styleAttributes(styles.title)], config.title);

  const description = pipe(
    Option.fromNullishOr(config.description),
    Option.map((content) => html.p([...parts.description, ...styleAttributes(styles.description)], content)),
    Option.toArray,
  );

  const header = html.div(styleAttributes(styles.header), [title, ...description]);

  const actions = pipe(
    Option.fromNullishOr(config.actions),
    Option.map((toActions) => html.div(styleAttributes(styles.actions), toActions(parts.closeButton))),
    Option.toArray,
  );

  const close = Bool.match(config.hasCloseButton ?? true, {
    onFalse: (): readonly Html[] => [],
    onTrue: (): readonly Html[] => [closeButton(parts.closeButton, html)],
  });

  return html.div(
    [...parts.panel, ...styleAttributes(styles.panel, config.style)],
    [header, ...(config.body ?? []), ...actions, ...close],
  );
};

const render = <Message>(config: DialogOptions, html: HtmlBuilder<Message>): ViewInputs => ({
  hasDescription: Predicate.isNotUndefined(config.description),
  toView: (rendered): Html =>
    html.dialog(
      [...rendered.dialog, ...styleAttributes(rendered.isVisible && styles.dialog)],
      Bool.match(rendered.isVisible, {
        onFalse: (): readonly Html[] => [],
        onTrue: (): readonly Html[] => [
          html.div([...rendered.backdrop, ih.DataAttribute("part", "overlay"), ...styleAttributes(styles.overlay)]),
          panel(config, rendered, html),
        ],
      }),
    ),
});

const dialogArity = 2;

const dialogViewInputs: {
  <Message>(html: HtmlBuilder<Message>): (config: DialogOptions) => ViewInputs;
  <Message>(config: DialogOptions, html: HtmlBuilder<Message>): ViewInputs;
} = Fn.dual(dialogArity, render);

export { type CloseAttributes, type DialogOptions, dialogViewInputs };
