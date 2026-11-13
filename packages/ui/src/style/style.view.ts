import { create, props } from "@stylexjs/stylex";
import type { CompiledStyles, StyleXStyles } from "@stylexjs/stylex";
import { Option, Record as Rec, pipe } from "effect";
import { inertHtml as ih } from "foldkit/html";
import type { Attribute, Html } from "foldkit/html";

import { colors } from "#src/tokens/tokens.stylex.js";

// What a component renders inside itself: elements and text.
type Content = readonly (Html | string)[];

// The styles of a stylex.create namespace, a theme from stylex.createTheme, or false and null for a style switched off.
type StyleArgument = StyleXStyles | CompiledStyles;

const inlineStyle = (style: Readonly<Record<string, string | number>>): Attribute<never> =>
  ih.Style(Rec.map(style, String));

// FoldKit keeps only the last Class attribute on an element, so all of an element's styles go through one
// Stylex.props call and come back as one Class, plus a Style when a dynamic style is passed.
const styleAttributes = (...styles: readonly StyleArgument[]): readonly Attribute<never>[] => {
  const { className, style } = props(...styles);

  return [
    ...pipe(Option.fromNullishOr(className), Option.map(ih.Class), Option.toArray),
    ...pipe(Option.fromNullishOr(style), Option.map(inlineStyle), Option.toArray),
  ];
};

const shared = create({
  focusRing: {
    outlineColor: colors.ring,
    outlineOffset: "2px",
    outlineStyle: { ":focus-visible": "solid", default: "none" },
    outlineWidth: "2px",
  },
  visuallyHidden: {
    borderWidth: 0,
    clipPath: "inset(50%)",
    height: "1px",
    margin: "-1px",
    overflow: "hidden",
    padding: 0,
    position: "absolute",
    whiteSpace: "nowrap",
    width: "1px",
  },
});

export { type Content, shared, type StyleArgument, styleAttributes };
