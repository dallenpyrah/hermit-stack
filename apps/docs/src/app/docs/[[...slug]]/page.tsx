import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { source } from "#src/content/source.build.ts";

interface PageParams {
  readonly params: Promise<{ readonly slug?: string[] }>;
}

type Page = NonNullable<ReturnType<typeof source.getPage>>;

const pageOf = (slug: string[] | undefined): Page => source.getPage(slug) ?? notFound();

export const dynamicParams = false;

export const generateStaticParams = (): ReturnType<typeof source.generateParams> => source.generateParams();

export const generateMetadata = async ({ params }: PageParams): Promise<Metadata> => {
  const { slug } = await params;
  const page = pageOf(slug);

  return { description: page.data.description, title: page.data.title };
};

const DocsRoutePage = async ({ params }: PageParams): Promise<ReactElement> => {
  const { slug } = await params;
  const page = pageOf(slug);
  const Body = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <Body components={defaultMdxComponents} />
      </DocsBody>
    </DocsPage>
  );
};

export default DocsRoutePage;
