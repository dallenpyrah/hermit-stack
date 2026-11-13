import { Array as Arr, String as Str, pipe } from "effect";

interface CodeFence {
  readonly code: string;
  readonly language: string;
  // The page line of the fence's first code line, counting from 1.
  readonly line: number;
}

const checkedLanguages: readonly string[] = ["ts", "typescript"];

// A fence closes with the same indent and marker it opened with, which also covers fences nested in list items.
const fencePattern =
  /^(?<indent> *)(?<marker>`{3,}|~{3,})(?<language>[\w-]*)[^\n]*\n(?<code>[\s\S]*?)^\k<indent>\k<marker>[ \t]*$/gmu;

// The opening fence takes one line, so the code starts on the line after it.
const LINES_BEFORE_CODE = 2;

const FIRST_LINE = 1;

const PAGE_START = 0;

const lineOf = (markdown: string, offset: number): number =>
  Str.split(markdown.slice(PAGE_START, offset), "\n").length - FIRST_LINE + LINES_BEFORE_CODE;

// A fence in a list item is indented with the item, and its code lines carry that indent too.
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

// Every TypeScript fence on a page, with the line it starts on, so a type error can name the page line.
const typeScriptFences = (markdown: string): readonly CodeFence[] =>
  pipe(
    Arr.fromIterable(markdown.matchAll(fencePattern)),
    Arr.map((match) => fenceOf(markdown, match)),
    Arr.filter((fence) => Arr.contains(checkedLanguages, fence.language)),
  );

// The fence as a module whose line numbers are the page's, so an error at `line-12.ts(14,3)` is at page line 14.
const pageAlignedSource = (fence: CodeFence): string => `${Str.repeat(fence.line - FIRST_LINE)("\n")}${fence.code}\n`;

export { pageAlignedSource, typeScriptFences };

export type { CodeFence };
