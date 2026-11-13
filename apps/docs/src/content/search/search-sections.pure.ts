import { Effect, Option, Schema } from "effect";

import { plainText } from "#src/content/toc/toc-items.pure.ts";
import type { PageHeading, PageTocEntry } from "#src/content/toc/toc-items.pure.ts";

interface SearchSection {
  readonly title: string;
  readonly parent?: string | undefined;
  readonly text?: string | undefined;
}

interface SearchablePage {
  readonly url: string;
  readonly toc: readonly PageTocEntry[];
  readonly structuredData: {
    readonly headings: readonly PageHeading[];
    readonly contents: readonly {
      readonly heading?: string | undefined;
      readonly content: string;
    }[];
  };
}

interface Ancestor {
  readonly depth: number;
  readonly title: string;
}

interface Placement {
  readonly above: Ancestor[];
  readonly depth: number;
  readonly id: string;
  readonly parents: Map<string, string>;
  readonly title: string;
}

interface HeadingLookup {
  readonly page: SearchablePage;
  readonly parents: ReadonlyMap<string, string>;
  readonly heading: PageHeading;
}

const SECTIONS_URL = "/search-sections.json";

const LEADING_HASH = /^#/u;

const NONE = 0;

const LAST = -1;

const SectionsFile = Schema.Record(Schema.String, Schema.Json);

const Text = Schema.optionalKey(Schema.String.pipe(Schema.catchDecoding(() => Effect.succeedNone)));

const Section = Schema.Struct({ parent: Text, text: Text, title: Schema.String });

const titlesOf = (page: SearchablePage): ReadonlyMap<string, string> =>
  new Map(page.structuredData.headings.map((heading) => [heading.id, plainText(heading.content)]));

const place = (input: Placement): void => {
  while ((input.above.at(LAST)?.depth ?? NONE) >= input.depth) {
    input.above.pop();
  }

  const parent = Option.fromNullishOr(input.above.at(LAST));

  if (Option.isSome(parent)) {
    input.parents.set(input.id, parent.value.title);
  }

  input.above.push({ depth: input.depth, title: input.title });
};

const parentsOf = (page: SearchablePage): ReadonlyMap<string, string> => {
  const parents = new Map<string, string>();
  const above: Ancestor[] = [];
  const titles = titlesOf(page);

  for (const entry of page.toc) {
    const id = entry.url.replace(LEADING_HASH, "");

    place({ above, depth: entry.depth, id, parents, title: titles.get(id) ?? id });
  }

  return parents;
};

const sectionOf = (input: HeadingLookup): readonly [string, SearchSection] => {
  const { heading, page, parents } = input;
  const text = Option.fromNullishOr(page.structuredData.contents.find((part) => part.heading === heading.id));

  return [
    `${page.url}#${heading.id}`,
    {
      parent: parents.get(heading.id),
      text: Option.getOrUndefined(Option.map(text, (part) => plainText(part.content))),
      title: plainText(heading.content),
    },
  ];
};

const sectionsOfPage = (page: SearchablePage): readonly (readonly [string, SearchSection])[] => {
  const parents = parentsOf(page);

  return page.structuredData.headings.map((heading) => sectionOf({ heading, page, parents }));
};

const searchSections = (pages: readonly SearchablePage[]): Record<string, SearchSection> =>
  Object.fromEntries(pages.flatMap((page) => sectionsOfPage(page)));

const sectionsOfFile = (file: Readonly<Record<string, Schema.Json>>): ReadonlyMap<string, SearchSection> =>
  new Map(
    Object.entries(file).flatMap(([address, entry]): readonly (readonly [string, SearchSection])[] => {
      const section = Schema.decodeUnknownOption(Section)(entry);

      if (Option.isNone(section)) {
        return [];
      }

      return [[address, section.value]];
    }),
  );

const loadSearchSections = (
  request: (address: string) => Promise<Pick<Response, "ok" | "json">>,
): Promise<ReadonlyMap<string, SearchSection>> =>
  Effect.runPromise(
    Effect.gen(function* load() {
      const response = yield* Effect.tryPromise(() => request(SECTIONS_URL));

      if (!response.ok) {
        return new Map<string, SearchSection>();
      }

      const file = Schema.decodeUnknownOption(SectionsFile)(yield* Effect.tryPromise(() => response.json()));

      return Option.match(file, {
        onNone: () => new Map<string, SearchSection>(),
        onSome: sectionsOfFile,
      });
    }).pipe(Effect.orElseSucceed(() => new Map<string, SearchSection>())),
  );

export { loadSearchSections, searchSections };

export type { SearchSection };
