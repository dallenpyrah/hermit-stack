import { Array as Arr, String as Str, pipe } from "effect";

interface CodeFence {
  readonly code: string;
  readonly language: string;
  readonly line: number;
}

const checkedLanguages: readonly string[] = ["ts", "typescript"];

const fencePattern =
  /^(?<indent> *)(?<marker>`{3,}|~{3,})(?<language>[\w-]*)[^\n]*\n(?<code>[\s\S]*?)^\k<indent>\k<marker>[ \t]*$/gmu;

const LINES_BEFORE_CODE = 2;

const FIRST_LINE = 1;

const PAGE_START = 0;

const lineOf = (markdown: string, offset: number): number =>
  Str.split(markdown.slice(PAGE_START, offset), "\n").length - FIRST_LINE + LINES_BEFORE_CODE;

const dedent = (code: string, indent: string): string => {
  const leading = new RegExp(`^ {0,${indent.length}}`, "u");

  return pipe(
    Str.split(Str.replace(/\n$/u, "")(code), "\n"),
    Arr.map((text) => Str.replace(leading, "")(text)),
    Arr.join("\n"),
  );
};

const fenceOf = (markdown: string, match: RegExpExecArray): CodeFence => ({
  code: dedent(match.groups?.code ?? "", match.groups?.indent ?? ""),
  language: match.groups?.language ?? "",
  line: lineOf(markdown, match.index),
});

const typeScriptFences = (markdown: string): readonly CodeFence[] =>
  pipe(
    Arr.fromIterable(markdown.matchAll(fencePattern)),
    Arr.map((match) => fenceOf(markdown, match)),
    Arr.filter((fence) => Arr.contains(checkedLanguages, fence.language)),
  );

const pageAlignedSource = (fence: CodeFence): string => `${Str.repeat(fence.line - FIRST_LINE)("\n")}${fence.code}\n`;

export { pageAlignedSource, typeScriptFences };

export type { CodeFence };
