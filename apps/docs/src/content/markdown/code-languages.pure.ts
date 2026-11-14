const labels = new Map([
  ["bash", "Terminal"],
  ["http", "HTTP"],
  ["javascript", "JavaScript"],
  ["js", "JavaScript"],
  ["json", "JSON"],
  ["jsonc", "JSON"],
  ["markdown", "Markdown"],
  ["plaintext", "Text"],
  ["sh", "Terminal"],
  ["shell", "Terminal"],
  ["sql", "SQL"],
  ["text", "Text"],
  ["ts", "TypeScript"],
  ["tsx", "TSX"],
  ["typescript", "TypeScript"],
  ["yaml", "YAML"],
]);

const LANGUAGE_CLASS = /(?:^|\s)language-(?<language>\S+)/u;

const languageLabel = (language?: string): string => labels.get(language ?? "") ?? language ?? "Text";

const languageOf = (className?: string): string | undefined => LANGUAGE_CLASS.exec(className ?? "")?.groups?.language;

export { languageLabel, languageOf };
