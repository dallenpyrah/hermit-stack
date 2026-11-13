interface PageTocEntry {
  readonly url: string;
  readonly depth: number;
}

interface PageHeading {
  readonly id: string;
  readonly content: string;
}

interface TocItem {
  readonly title: string;
  readonly id: string;
  readonly depth: number;
}

const CODE_SPAN = /`(?<code>[^`]*)`/gu;

const LEADING_HASH = /^#/u;

const plainText = (content: string): string => content.replaceAll(CODE_SPAN, "$<code>");

const tocItems = (entries: readonly PageTocEntry[], headings: readonly PageHeading[]): readonly TocItem[] => {
  const titles = new Map(headings.map((heading) => [heading.id, plainText(heading.content)]));

  return entries.map((entry) => {
    const id = entry.url.replace(LEADING_HASH, "");

    return { depth: entry.depth, id, title: titles.get(id) ?? id };
  });
};

export { plainText, tocItems };

export type { PageHeading, PageTocEntry, TocItem };
