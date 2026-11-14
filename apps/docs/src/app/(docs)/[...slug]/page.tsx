import type { Metadata } from "next";
import type { ReactElement } from "react";

import { mdxComponents } from "#src/components/mdx/mdx-components.view.tsx";
import { DocFrame } from "#src/components/shell/doc-frame.view.tsx";
import { pageUrl } from "#src/content/markdown/page-markdown.pure.ts";
import { publishedSlugs } from "#src/content/navigation/navigation.pure.ts";
import { siteUrl } from "#src/content/site/site.pure.ts";
import { pageOf } from "#src/content/site/source.config.ts";
import { tocItems } from "#src/content/toc/toc-items.pure.ts";

interface PageParams {
  readonly params: Promise<{ readonly slug: readonly string[] }>;
}

export const dynamicParams = false;

export const generateStaticParams = (): { slug: string[] }[] =>
  publishedSlugs.map((slug) => ({ slug: slug.split("/") }));

export const generateMetadata = async (props: PageParams): Promise<Metadata> => {
  const { slug } = await props.params;
  const page = pageOf(slug.join("/"));
  const url = pageUrl(siteUrl, slug.join("/"));

  return {
    alternates: { canonical: url },
    description: page.data.description,
    openGraph: {
      description: page.data.description,
      title: page.data.title,
      type: "article",
      url,
    },
    title: page.data.title,
  };
};

const DocsPageRoute = async (props: PageParams): Promise<ReactElement> => {
  const { slug } = await props.params;
  const page = pageOf(slug.join("/"));
  const Body = page.data.body;

  return (
    <DocFrame
      planned={page.data.status === "planned"}
      slug={slug.join("/")}
      title={page.data.title}
      toc={tocItems(page.data.toc, page.data.structuredData.headings)}
    >
      <Body components={mdxComponents} />
    </DocFrame>
  );
};

export default DocsPageRoute;
