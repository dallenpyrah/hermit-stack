import type { ReactElement, ReactNode } from "react";

import type { TocItem } from "#src/content/toc/toc-items.pure.ts";
import { siteName } from "#src/content/site/site.pure.ts";
import { Callout } from "#src/components/mdx/callout.view.tsx";
import { PageActions } from "#src/components/mdx/page-actions.view.tsx";
import { PageFooter } from "./page-footer.view.tsx";
import { Toc } from "./toc.view.tsx";

const PlannedNotice = (props: { readonly planned: boolean }): ReactNode => {
  if (props.planned) {
    return (
      <Callout type="planned">
        <p>
          <strong>Planned.</strong> This part of {siteName} is designed but not built yet. The page describes the
          decision and how it will be checked; shapes in <code>text</code> blocks are sketches, not APIs you can import
          today.
        </p>
      </Callout>
    );
  }

  return [];
};

export const DocFrame = (props: {
  readonly title: string;
  readonly slug: string;
  readonly toc: readonly TocItem[];
  readonly planned: boolean;
  readonly children: ReactNode;
}): ReactElement => (
  <div className="hs-page-grid">
    <article className="hs-page" data-kind="doc">
      <header className="hs-head">
        <h1 className="hs-title">{props.title}</h1>
        <PageActions slug={props.slug} />
      </header>
      <div className="hs-prose">
        <PlannedNotice planned={props.planned} />
        {props.children}
      </div>
      <PageFooter slug={props.slug} />
    </article>
    <aside className="hs-toc-col">
      <div className="hs-page-rail">
        <Toc items={props.toc} />
      </div>
    </aside>
  </div>
);
