import { create, props } from "@stylexjs/stylex";
import type { CompiledStyles, StyleXStyles } from "@stylexjs/stylex";
import { Option, Record as Rec, pipe } from "effect";
import { inertHtml as ih } from "foldkit/html";
import type { Attribute, Html } from "foldkit/html";

import { colors } from "#src/tokens/tokens.stylex.js";

type Content = readonly (Html | string)[];

type StyleArgument = StyleXStyles | CompiledStyles;

const inlineStyle = (style: Readonly<Record<string, string | number>>): Attribute<never> =>
  ih.Style(Rec.map(style, String));

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
