"use client";

import { Effect, Option, Ref } from "effect";
import { constVoid } from "effect/Function";
import { experimental_useSearch as useSearch } from "fumadocs-core/search/client";
import type { SearchClient, SearchResult, SearchResultItem, SearchResultRecord } from "fumadocs-core/search/client";
import { staticClient } from "fumadocs-core/search/client/orama-static";
import type { SortedResult } from "fumadocs-core/search";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, KeyboardEvent, ReactElement, RefObject, SetStateAction } from "react";

import { loadSearchSections } from "#src/content/search/search-sections.pure.ts";
import type { SearchSection } from "#src/content/search/search-sections.pure.ts";
import { suggestedHrefs } from "#src/content/navigation/sidebar.pure.ts";
import type { Sidebar } from "#src/content/navigation/sidebar.pure.ts";
import { plainText } from "#src/content/toc/toc-items.pure.ts";
import { Dialog, Footer, PaletteInput, Results } from "./search-results.view.tsx";
import type { Row, RowGroup } from "./search-results.view.tsx";

const FIRST = 0;
const NEXT = 1;
const PREVIOUS = -1;
const NOT_FOUND = -1;
const NO_FAILURES = 0;
const WINDOW = 40;

interface PromisedSearchClient extends SearchClient {
  readonly search: (query: string) => Promise<SortedResult[]>;
}

interface PageEntry {
  readonly description: Option.Option<string>;
  readonly group: string;
  readonly title: string;
}

interface Lookup {
  readonly listed: ReadonlySet<string>;
  readonly pages: ReadonlyMap<string, PageEntry>;
  readonly paragraphs: ReadonlySet<string>;
  readonly sections: ReadonlyMap<string, SearchSection>;
  readonly terms: readonly string[];
}

interface RowInputs {
  readonly found: SearchResult | undefined;
  readonly sections: ReadonlyMap<string, SearchSection>;
  readonly sidebar: Sidebar;
  readonly terms: readonly string[];
}

interface RowSet {
  readonly groups: readonly RowGroup[];
  readonly ordered: readonly Row[];
}

interface KeyContext {
  readonly highlighted: number;
  readonly onClose: () => void;
  readonly ordered: readonly Row[];
  readonly setHighlighted: Dispatch<SetStateAction<number>>;
}

interface DocsSearch {
  readonly failed: boolean;
  readonly found: SearchResult | undefined;
  readonly onSearchChange: (search: string) => void;
  readonly search: string;
}

interface Highlight {
  readonly highlighted: number;
  readonly list: RefObject<HTMLDivElement | null>;
  readonly setHighlighted: Dispatch<SetStateAction<number>>;
}

const failures = Ref.makeUnsafe(NO_FAILURES);

const sectionsRequest = Ref.makeUnsafe(Option.none<Promise<ReadonlyMap<string, SearchSection>>>());

const loadSections = Ref.updateAndGet(sectionsRequest, (current) =>
  Option.orElse(current, () => Option.some(loadSearchSections(globalThis.fetch))),
).pipe(Effect.flatMap((request) => Effect.promise(() => Option.getOrThrow(request))));

const searchIndexAddress = (): string => {
  const count = Ref.getUnsafe(failures);

  if (count === NO_FAILURES) {
    return "/search.json";
  }

  return `/search.json?retry=${count}`;
};

const searchClient: PromisedSearchClient = {
  deps: [],
  search: (query) =>
    Effect.runPromise(
      Effect.tapCause(
        Effect.promise(() => Promise.resolve(staticClient({ from: searchIndexAddress() }).search(query))),
        () => Ref.update(failures, (count) => count + NEXT),
      ),
    ),
};

const positionOf = (lower: string, term: string): readonly number[] => {
  const index = lower.indexOf(term.toLowerCase());

  if (index === NOT_FOUND) {
    return [];
  }

  return [index];
};

const windowed = (text: string, terms: readonly string[]): string => {
  const lower = text.toLowerCase();
  const at = Math.min(...terms.flatMap((term) => positionOf(lower, term)));

  if (Number.isFinite(at) && at > WINDOW) {
    return `…${text.slice(at - WINDOW)}`;
  }

  return text;
};

const pagesOf = (sidebar: Sidebar): ReadonlyMap<string, PageEntry> =>
  new Map(
    sidebar.groups.flatMap((group) =>
      group.items.map((item): readonly [string, PageEntry] => [
        item.href,
        { description: Option.fromNullishOr(item.description), group: group.heading, title: item.title },
      ]),
    ),
  );

const termsOf = (search: string): readonly string[] => search.split(/\s+/u).filter((term) => term !== "");

const suggestedRow = (pages: ReadonlyMap<string, PageEntry>, href: string): readonly Row[] =>
  Option.fromNullishOr(pages.get(href)).pipe(
    Option.map((page): Row => ({
      group: "Suggested",
      href,
      key: href,
      kind: "page",
      snippet: Option.none(),
      title: page.title,
      trail: page.group,
    })),
    Option.toArray,
  );

const urlsOf = (items: readonly SearchResultItem[], type: "page" | "text"): ReadonlySet<string> =>
  new Set(
    items.flatMap((item) => {
      if (item.type === type) {
        return [item.url];
      }

      return [];
    }),
  );

const pageTitle = (item: SearchResultRecord, page: PageEntry): string => {
  if (item.type === "page") {
    return item.content;
  }

  return page.title;
};

const pageRow = (item: SearchResultRecord, page: PageEntry, terms: readonly string[]): Row => ({
  group: page.group,
  href: item.url,
  key: item.id,
  kind: "page",
  snippet: Option.map(page.description, (description) => windowed(description, terms)),
  title: pageTitle(item, page),
  trail: page.group,
});

const openingOf = (item: SearchResultRecord, section: Option.Option<SearchSection>): Option.Option<string> => {
  if (item.type === "text") {
    return Option.some(plainText(item.content));
  }

  return Option.flatMap(section, (found) => Option.fromNullishOr(found.text));
};

const headingTitle = (item: SearchResultRecord, section: Option.Option<SearchSection>, page: PageEntry): string => {
  if (item.type === "heading") {
    return plainText(item.content);
  }

  return Option.match(section, { onNone: () => page.title, onSome: (found) => found.title });
};

const trailOf = (page: PageEntry, section: Option.Option<SearchSection>): string => {
  const parent = Option.flatMap(section, (found) => Option.fromNullishOr(found.parent));

  return Option.match(parent, {
    onNone: () => page.title,
    onSome: (name) => `${page.title} › ${name}`,
  });
};

const headingRow = (item: SearchResultRecord, page: PageEntry, lookup: Lookup): Row => {
  const section = Option.fromNullishOr(lookup.sections.get(item.url));

  return {
    group: page.group,
    href: item.url,
    key: item.id,
    kind: "heading",
    snippet: Option.map(openingOf(item, section), (opening) => windowed(opening, lookup.terms)),
    title: headingTitle(item, section, page),
    trail: trailOf(page, section),
  };
};

const addressOf = (url: string): string => url.split("#")[FIRST] ?? "";

const rowsOfPage = (item: SearchResultRecord, page: PageEntry, lookup: Lookup): readonly Row[] => {
  const describes = item.type === "text" && Option.exists(page.description, (text) => text === item.content);

  if (item.type === "page" || (describes && !lookup.listed.has(addressOf(item.url)))) {
    return [pageRow(item, page, lookup.terms)];
  }

  if (describes || (item.type === "heading" && lookup.paragraphs.has(item.url))) {
    return [];
  }

  return [headingRow(item, page, lookup)];
};

const rowsFor = (item: SearchResultItem, lookup: Lookup): readonly Row[] => {
  if (item.type === "table") {
    return [];
  }

  const page = Option.fromNullishOr(lookup.pages.get(addressOf(item.url)));

  return Option.match(page, {
    onNone: () => [],
    onSome: (entry) => rowsOfPage(item, entry, lookup),
  });
};

const rowsOf = (pages: ReadonlyMap<string, PageEntry>, inputs: RowInputs): readonly Row[] => {
  if (inputs.terms.length === FIRST) {
    return suggestedHrefs.flatMap((href) => suggestedRow(pages, href));
  }

  const items = inputs.found?.items ?? [];

  const lookup: Lookup = {
    listed: urlsOf(items, "page"),
    pages,
    paragraphs: urlsOf(items, "text"),
    sections: inputs.sections,
    terms: inputs.terms,
  };

  return items.flatMap((item) => rowsFor(item, lookup));
};

const groupRows = (rows: readonly Row[]): readonly RowGroup[] => {
  const byGroup = new Map<string, Row[]>();

  for (const row of rows) {
    byGroup.set(row.group, [...(byGroup.get(row.group) ?? []), row]);
  }

  return [...byGroup.entries()];
};

const stepFor = (backwards: boolean): number => {
  if (backwards) {
    return PREVIOUS;
  }

  return NEXT;
};

const moveHighlight = (event: KeyboardEvent, context: KeyContext): void => {
  const step = stepFor(event.key === "ArrowUp");

  event.preventDefault();
  context.setHighlighted((index) => Math.max(FIRST, Math.min(context.ordered.length - NEXT, index + step)));
};

const openHighlighted = (event: KeyboardEvent, context: KeyContext): void => {
  if (context.highlighted >= context.ordered.length) {
    return;
  }

  event.preventDefault();
  globalThis.document.querySelector<HTMLElement>(`#hs-cmd-${context.highlighted}`)?.click();
};

const closePalette = (event: KeyboardEvent, context: KeyContext): void => {
  event.preventDefault();
  context.onClose();
};

const keyHandlers: ReadonlyMap<string, (event: KeyboardEvent, context: KeyContext) => void> = new Map([
  ["ArrowDown", moveHighlight],
  ["ArrowUp", moveHighlight],
  ["Enter", openHighlighted],
  ["Escape", closePalette],
]);

const handleKey = (event: KeyboardEvent, context: KeyContext): void => {
  Option.match(Option.fromNullishOr(keyHandlers.get(event.key)), {
    onNone: constVoid,
    onSome: (handler): void => {
      handler(event, context);
    },
  });
};

const useDocsSearch = (): DocsSearch => {
  const run = useCallback((query: string) => searchClient.search(query), []);
  const { data: found, error, onSearchChange, search } = useSearch(run);

  return { failed: Option.isSome(Option.fromNullishOr(error)), found, onSearchChange, search };
};

const useSections = (): ReadonlyMap<string, SearchSection> => {
  const [sections, setSections] = useState<ReadonlyMap<string, SearchSection>>(new Map());

  useEffect((): void => {
    Effect.runFork(
      Effect.map(loadSections, (loaded): void => {
        setSections(loaded);
      }),
    );
  }, []);

  return sections;
};

const useRows = (inputs: RowInputs): RowSet => {
  const pages = useMemo(() => pagesOf(inputs.sidebar), [inputs.sidebar]);

  const rows = useMemo(() => rowsOf(pages, inputs), [inputs.found, pages, inputs.sections, inputs.terms]);

  const groups = useMemo(() => groupRows(rows), [rows]);
  const ordered = useMemo(() => groups.flatMap(([, group]) => group), [groups]);

  return { groups, ordered };
};

const useAutoFocus = (): RefObject<HTMLInputElement | null> => {
  const input = useRef<HTMLInputElement>(null);

  useEffect((): void => {
    input.current?.focus();
  }, []);

  return input;
};

const useHighlight = (ordered: readonly Row[]): Highlight => {
  const list = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState(FIRST);

  useEffect((): void => {
    setHighlighted(FIRST);
  }, [ordered]);

  useEffect((): void => {
    list.current?.querySelector("[data-highlighted]")?.scrollIntoView({ block: "nearest" });
  }, [highlighted, ordered]);

  return { highlighted, list, setHighlighted };
};

const SearchPalette = (props: { readonly sidebar: Sidebar; readonly onClose: () => void }): ReactElement => {
  const { failed, found, onSearchChange, search } = useDocsSearch();
  const sections = useSections();
  const terms = useMemo(() => termsOf(search), [search]);
  const { groups, ordered } = useRows({ found, sections, sidebar: props.sidebar, terms });
  const input = useAutoFocus();
  const { highlighted, list, setHighlighted } = useHighlight(ordered);

  return (
    <Dialog
      onClose={props.onClose}
      onKeyDown={(event): void => {
        handleKey(event, { highlighted, onClose: props.onClose, ordered, setHighlighted });
      }}
    >
      <PaletteInput highlighted={highlighted} input={input} onSearchChange={onSearchChange} search={search} />
      <Results
        failed={failed}
        groups={groups}
        highlighted={highlighted}
        list={list}
        onClose={props.onClose}
        onHover={setHighlighted}
        ordered={ordered}
        terms={terms}
      />
      <Footer />
    </Dialog>
  );
};

export { SearchPalette, searchClient, searchIndexAddress };
