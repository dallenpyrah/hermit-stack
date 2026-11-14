import { create, createTheme } from "@stylexjs/stylex";
import { Schema } from "effect";
import { inertHtml as ih } from "foldkit/html";
import type { Attribute } from "foldkit/html";

import { styleAttributes } from "#src/style/style.view.js";
import type { StyleArgument } from "#src/style/style.view.js";
import { colors, font } from "#src/tokens/tokens.stylex.js";

const ThemeName = Schema.Literals(["light", "dark"]);

type ThemeName = typeof ThemeName.Type;

const light = createTheme(colors, {});

const dark = createTheme(colors, {
  accent: "oklch(0.269 0 0)",
  accentForeground: "oklch(0.985 0 0)",
  background: "oklch(0.145 0 0)",
  border: "oklch(1 0 0 / 10%)",
  card: "oklch(0.205 0 0)",
  cardForeground: "oklch(0.985 0 0)",
  destructive: "oklch(0.704 0.191 22.216)",
  destructiveForeground: "oklch(0.145 0 0)",
  foreground: "oklch(0.985 0 0)",
  input: "oklch(0.55 0 0)",
  muted: "oklch(0.269 0 0)",
  mutedForeground: "oklch(0.708 0 0)",
  overlay: "oklch(0 0 0 / 70%)",
  popover: "oklch(0.205 0 0)",
  popoverForeground: "oklch(0.985 0 0)",
  primary: "oklch(0.922 0 0)",
  primaryForeground: "oklch(0.205 0 0)",
  ring: "oklch(0.708 0 0)",
  secondary: "oklch(0.269 0 0)",
  secondaryForeground: "oklch(0.985 0 0)",
});

const surface = create({
  dark: { colorScheme: "dark" },
  light: { colorScheme: "light" },
  root: {
    backgroundColor: colors.background,
    color: colors.foreground,
    fontFamily: font.sans,
  },
});

const themes = { dark, light };

const themeStyles = (name: ThemeName): readonly StyleArgument[] => [themes[name], surface[name], surface.root];

const themeAttributes = (name: ThemeName): readonly Attribute<never>[] => [
  ih.DataAttribute("theme", name),
  ...styleAttributes(...themeStyles(name)),
];

export { ThemeName, themeAttributes, themes, themeStyles };
