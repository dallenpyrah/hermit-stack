import type { ThemeRegistration } from "shiki";

interface Palette {
  readonly comment: string;
  readonly ink: string;
  readonly keyword: string;
  readonly name: string;
  readonly number: string;
  readonly string: string;
  readonly type: "dark" | "light";
}

// The colors are CSS variables from tokens.css, which resolve per theme, so the same palette serves light and dark.
const paletteFor = (type: "dark" | "light"): Palette => ({
  comment: "var(--code-comment)",
  ink: "var(--code-ink)",
  keyword: "var(--code-keyword)",
  name: `hermit-stack-${type}`,
  number: "var(--code-number)",
  string: "var(--code-string)",
  type,
});

const palettes: Readonly<Record<"dark" | "light", Palette>> = { dark: paletteFor("dark"), light: paletteFor("light") };

const keywordScopes = [
  "keyword",
  "storage",
  "storage.type",
  "storage.modifier",
  "keyword.control",
  "keyword.operator.new",
];

const stringScopes = ["string", "string.quoted", "string.template", "constant.character.escape"];

const numberScopes = ["constant.numeric"];

const commentScopes = ["comment", "punctuation.definition.comment"];

const theme = (palette: Palette): ThemeRegistration => ({
  bg: "transparent",
  colors: { "editor.background": "#00000000", "editor.foreground": palette.ink },
  fg: palette.ink,
  name: palette.name,
  tokenColors: [
    { scope: keywordScopes, settings: { foreground: palette.keyword } },
    { scope: stringScopes, settings: { foreground: palette.string } },
    { scope: numberScopes, settings: { foreground: palette.number } },
    { scope: commentScopes, settings: { foreground: palette.comment } },
  ],
  type: palette.type,
});

const codeThemes = { dark: theme(palettes.dark), light: theme(palettes.light) };

export { codeThemes };
