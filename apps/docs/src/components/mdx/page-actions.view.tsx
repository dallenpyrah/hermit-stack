"use client";

import { Effect } from "effect";
import { useState } from "react";
import type { ReactElement } from "react";

import { CheckGlyph, CopyGlyph } from "#src/components/brand/glyphs.view.tsx";

const COPIED_MS = 2000;

const labelOf = (copied: boolean): string => {
  if (copied) {
    return "Copied";
  }

  return "Copy as Markdown";
};

const glyphOf = (copied: boolean): ReactElement => {
  if (copied) {
    return <CheckGlyph aria-hidden="true" />;
  }

  return <CopyGlyph aria-hidden="true" />;
};

const copyMarkdown = (markdownPath: string, setCopied: (copied: boolean) => void): Effect.Effect<void> =>
  Effect.gen(function* copy() {
    const response = yield* Effect.promise(() => globalThis.fetch(markdownPath));
    const markdown = yield* Effect.promise(() => response.text());

    yield* Effect.promise(() => globalThis.navigator.clipboard.writeText(markdown));
    setCopied(true);
    yield* Effect.sleep(COPIED_MS);
    setCopied(false);
  });

export const PageActions = (props: { readonly slug: string }): ReactElement => {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="hs-copy-page"
      onClick={(): void => {
        Effect.runFork(copyMarkdown(`/${props.slug}.md`, setCopied));
      }}
    >
      {glyphOf(copied)}
      <span aria-live="polite">{labelOf(copied)}</span>
    </button>
  );
};
