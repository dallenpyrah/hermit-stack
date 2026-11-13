"use client";

import { Array as Arr } from "effect";
import { AnchorProvider, TOCItem } from "fumadocs-core/toc";
import { useMemo } from "react";
import type { ReactElement } from "react";

import type { TocItem } from "#src/content/toc/toc-items.pure.ts";

export const Toc = (props: { readonly items: readonly TocItem[] }): ReactElement => {
  const entries = useMemo(
    () => props.items.map((item) => ({ depth: item.depth, title: item.title, url: `#${item.id}` })),
    [props.items],
  );

  if (Arr.isReadonlyArrayEmpty(props.items)) {
    return <></>;
  }

  return (
    <AnchorProvider toc={entries}>
      <nav className="hs-toc" aria-label="On this page">
        <p className="hs-toc-title">On this page</p>
        <div className="hs-toc-list">
          {props.items.map((item): ReactElement => (
            <TOCItem key={item.id} href={`#${item.id}`} className="hs-toc-item" data-depth={item.depth}>
              {item.title}
            </TOCItem>
          ))}
        </div>
      </nav>
    </AnchorProvider>
  );
};
