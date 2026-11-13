import { Option } from "effect";
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { publishedSlugs } from "#src/content/navigation/navigation.pure.ts";
import { neighboursOf } from "#src/content/navigation/sidebar.pure.ts";
import type { SidebarItem } from "#src/content/navigation/sidebar.pure.ts";
import { contentPath, editLink } from "#src/content/site/site.pure.ts";
import { sidebar } from "#src/content/site/source.config.ts";

const landingSource = "apps/docs/src/content/navigation/landing-pages.pure.ts";

const sources: ReadonlyMap<string, string> = new Map([
  ...publishedSlugs.map((slug): readonly [string, string] => [slug, `${contentPath}/${slug}.md`]),
  ["welcome", landingSource],
]);

const Neighbour = (props: { readonly item: Option.Option<SidebarItem>; readonly label: string }): ReactNode =>
  Option.match(props.item, {
    onNone: (): ReactNode => <span className="hs-pager-gap" />,
    onSome: (item): ReactNode => (
      <Link className="hs-pager-link" data-direction={props.label.toLowerCase()} href={item.href}>
        <span className="hs-pager-label">{props.label}</span>
        <span className="hs-pager-title">{item.title}</span>
      </Link>
    ),
  });

const EditLink = (props: { readonly slug: string }): ReactNode =>
  Option.match(Option.fromNullishOr(sources.get(props.slug)), {
    onNone: (): ReactNode => [],
    onSome: (source): ReactNode => (
      <a className="hs-edit-link" href={editLink(source)}>
        Edit this page on GitHub
      </a>
    ),
  });

export const PageFooter = (props: { readonly slug: string }): ReactElement => {
  const neighbours = neighboursOf(sidebar, `/${props.slug}`);

  return (
    <footer className="hs-page-footer">
      <nav className="hs-pager" aria-label="Pages">
        <Neighbour item={neighbours.previous} label="Previous" />
        <Neighbour item={neighbours.next} label="Next" />
      </nav>
      <EditLink slug={props.slug} />
    </footer>
  );
};
