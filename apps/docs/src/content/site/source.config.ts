import { Option } from "effect";
import { loader } from "fumadocs-core/source";

import { docs } from "#source/server.ts";

import { welcomePage } from "#src/content/navigation/landing-pages.pure.ts";
import { publishedSlugs } from "#src/content/navigation/navigation.pure.ts";
import { buildSidebar } from "#src/content/navigation/sidebar.pure.ts";
import type { PageTitles } from "#src/content/navigation/sidebar.pure.ts";

const source = loader({ baseUrl: "/", source: docs.toFumadocsSource() });

const pageOf = (slug: string): NonNullable<ReturnType<typeof source.getPage>> => {
  const page = Option.fromNullishOr(source.getPage(slug.split("/")));

  if (Option.isNone(page)) {
    throw new Error(`content/${slug}.md is listed in the navigation but was not built`);
  }

  return page.value;
};

const titles: PageTitles = (slug) => {
  if (slug === welcomePage.slug) {
    return { description: welcomePage.description, status: "built", title: "Welcome" };
  }

  const page = pageOf(slug);

  return { description: page.data.description, status: page.data.status, title: page.data.title };
};

const sidebar = buildSidebar(titles);

const publishedPages = publishedSlugs.map((slug) => ({ page: pageOf(slug), slug }));

export { pageOf, publishedPages, sidebar, titles };
