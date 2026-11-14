import { Array as Arr, Match, Option, Record as Rec, String as Str, pipe } from "effect";
import type { Plugin, Rolldown } from "vite";

interface Emitted {
  readonly code: string;
  readonly fileName: string;
}

interface Inlining {
  readonly files: readonly Emitted[];
  readonly pattern: RegExp;
  readonly wrap: (code: string) => string;
}

type Output = Rolldown.OutputBundle[string];

const contentOf = (output: Output): string =>
  Match.value(output).pipe(
    Match.when({ type: "chunk" }, (chunk) => chunk.code),
    Match.orElse((asset) => String(asset.source)),
  );

const outputsEndingIn = (bundle: Rolldown.OutputBundle, extension: string): readonly Output[] =>
  Arr.filter(Rec.values(bundle), ({ fileName }) => Str.endsWith(extension)(fileName));

const emitted = (bundle: Rolldown.OutputBundle, extension: string): readonly Emitted[] =>
  Arr.map(outputsEndingIn(bundle, extension), (output) => ({ code: contentOf(output), fileName: output.fileName }));

const scriptSafe = Str.replaceAll("</script", String.raw`<\/script`);

const scriptTag = /<script type="module"[^>]*src="\.\/(?<file>[^"]+)"[^>]*><\/script>/gu;

const styleTag = /<link rel="stylesheet"[^>]*href="\.\/(?<file>[^"]+)"[^>]*>/gu;

const swap = (html: string, tag: string, replacement: string): string => Arr.join(Str.split(html, tag), replacement);

const inline = (html: string, { files, pattern, wrap }: Inlining): string =>
  Arr.reduce(Arr.fromIterable(Str.matchAll(pattern)(html)), html, (page, [tag, fileName]) =>
    pipe(
      Arr.findFirst(files, (file) => file.fileName === fileName),
      Option.match({ onNone: () => page, onSome: (file) => swap(page, tag, wrap(file.code)) }),
    ),
  );

const inlined = (html: string, bundle: Rolldown.OutputBundle): string => {
  const withScripts = inline(html, {
    files: emitted(bundle, ".js"),
    pattern: scriptTag,
    wrap: (code) => `<script type="module">${scriptSafe(code)}</script>`,
  });

  return inline(withScripts, {
    files: emitted(bundle, ".css"),
    pattern: styleTag,
    wrap: (code) => `<style>${code}</style>`,
  });
};

const singleFile = (): Plugin => ({
  apply: "build",
  enforce: "post",
  generateBundle(_options, bundle) {
    const documents = outputsEndingIn(bundle, ".html");

    const pages = Arr.map(documents, (document) => ({
      fileName: document.fileName,
      source: inlined(contentOf(document), bundle),
    }));

    const replaced = [...outputsEndingIn(bundle, ".js"), ...outputsEndingIn(bundle, ".css"), ...documents];

    for (const { fileName } of replaced) {
      Reflect.deleteProperty(bundle, fileName);
    }

    for (const page of pages) {
      this.emitFile({ ...page, type: "asset" });
    }
  },
  name: "hermit-stack:single-file",
});

export { singleFile };
