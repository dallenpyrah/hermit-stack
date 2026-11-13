"use client";

import { Effect, Option } from "effect";
import { useState } from "react";
import type { ReactElement } from "react";

import { CheckGlyph, CopyGlyph } from "#src/components/brand/glyphs.view.tsx";

const COPIED_MS = 2000;

const labelOf = (copied: boolean): string => {
  if (copied) {
    return "Copied";
  }

  return "Copy code";
};

const glyphOf = (copied: boolean): ReactElement => {
  if (copied) {
    return <CheckGlyph aria-hidden="true" />;
  }

  return <CopyGlyph aria-hidden="true" />;
};

export const CopyCodeButton = (): ReactElement => {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="hs-icon-btn"
      aria-label={labelOf(copied)}
      onClick={(event): void => {
        const text = Option.fromNullishOr(event.currentTarget.closest(".hs-code")?.querySelector("pre")?.textContent);

        if (Option.isNone(text)) {
          return;
        }

        Effect.runFork(Effect.promise(() => globalThis.navigator.clipboard.writeText(text.value)));
        setCopied(true);
        Effect.runFork(
          Effect.andThen(
            Effect.sleep(COPIED_MS),
            Effect.sync((): void => {
              setCopied(false);
            }),
          ),
        );
      }}
    >
      {glyphOf(copied)}
    </button>
  );
};
