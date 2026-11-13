import { Predicate } from "effect";

import { siteDescription, siteName } from "#src/content/site/site.pure.ts";

interface MarkdownPage {
  readonly origin: string;
  readonly slug: string;
  readonly title: string;
  readonly description?: string | undefined;
  readonly body: string;
}

interface MarkdownLink {
  readonly description?: string | undefined;
  readonly origin: string;
  readonly slug: string;
  readonly title: string;
}

interface LlmsSection {
  readonly heading: string;
  readonly pages: readonly {
    readonly slug: string;
    readonly title: string;
    readonly description?: string | undefined;
  }[];
}

const pageUrl = (origin: string, slug: string): string => `${origin}/${slug}`;

const markdownUrl = (origin: string, slug: string): string => `${origin}/${slug}.md`;

const quoteOf = (description: string | undefined): readonly string[] => {
  if (Predicate.isUndefined(description)) {
    return [];
  }

  return [`> ${description}`];
};

const suffixOf = (description: string | undefined): string => {
  if (Predicate.isUndefined(description)) {
    return "";
  }

  return `: ${description}`;
};

const markdownBullet = (link: MarkdownLink): string =>
  `- [${link.title}](${markdownUrl(link.origin, link.slug)})${suffixOf(link.description)}`;

const renderPageMarkdown = (page: MarkdownPage): string =>
  [`# ${page.title}`, ...quoteOf(page.description), `Source: ${pageUrl(page.origin, page.slug)}`, page.body.trim()]
    .join("\n\n")
    .concat("\n");

const renderLlmsIndex = (origin: string, sections: readonly LlmsSection[]): string =>
  [
    `# ${siteName}`,
    `> ${siteDescription}`,
    ...sections.map((section) =>
      [`## ${section.heading}`, ...section.pages.map((page) => markdownBullet({ ...page, origin }))].join("\n"),
    ),
  ]
    .join("\n\n")
    .concat("\n");

export { markdownBullet, pageUrl, renderLlmsIndex, renderPageMarkdown };

export type { LlmsSection };
