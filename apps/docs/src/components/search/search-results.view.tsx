import { Option } from "effect";
import { FileText, Hash, SearchX } from "lucide-react";
import Link from "next/link";
import type { KeyboardEvent, ReactElement, ReactNode, RefObject } from "react";

import { SearchGlyph } from "#src/components/brand/glyphs.view.tsx";

const NONE = 0;
const MATCH_STRIDE = 2;
const MATCH_REMAINDER = 1;

interface Row {
  readonly href: string;
  readonly key: string;
  readonly kind: "page" | "heading";
  readonly group: string;
  readonly snippet: Option.Option<string>;
  readonly title: string;
  readonly trail: string;
}

type RowGroup = readonly [string, readonly Row[]];

interface HighlightedAttribute {
  readonly "data-highlighted"?: string;
}

const ESCAPABLE = /[.*+?^${}()|[\]\\]/gu;

const escaped = (term: string): string => term.replaceAll(ESCAPABLE, String.raw`\$&`);

const highlight = (text: string, terms: readonly string[]): ReactNode => {
  if (terms.length === NONE) {
    return text;
  }

  const pattern = new RegExp(`(${terms.map((term) => escaped(term)).join("|")})`, "giu");

  return text.split(pattern).map((part, index): ReactNode => {
    if (index % MATCH_STRIDE === MATCH_REMAINDER) {
      return <mark key={index}>{part}</mark>;
    }

    return part;
  });
};

const highlightedOf = (active: boolean): HighlightedAttribute => {
  if (active) {
    return { "data-highlighted": "true" };
  }

  return {};
};

const NoResults = (): ReactElement => (
  <div className="hs-cmd-empty">
    <SearchX className="hs-cmd-empty-icon" aria-hidden="true" />
    <p className="hs-cmd-empty-title">No results</p>
    <p className="hs-cmd-empty-body">Try a different search term.</p>
  </div>
);

const Unavailable = (): ReactElement => (
  <div className="hs-cmd-empty" role="alert">
    <SearchX className="hs-cmd-empty-icon" aria-hidden="true" />
    <p className="hs-cmd-empty-title">Search unavailable.</p>
    <p className="hs-cmd-empty-body">Try again.</p>
  </div>
);

const leadOf = (kind: Row["kind"]): ReactElement => {
  if (kind === "page") {
    return <FileText aria-hidden="true" />;
  }

  return <Hash aria-hidden="true" />;
};

const Snippet = (props: { readonly snippet: Option.Option<string>; readonly terms: readonly string[] }): ReactElement =>
  Option.match(props.snippet, {
    onNone: (): ReactElement => <></>,
    onSome: (snippet): ReactElement => <span className="hs-cmd-snippet">{highlight(snippet, props.terms)}</span>,
  });

const ResultItem = (props: {
  readonly highlighted: number;
  readonly index: number;
  readonly onClose: () => void;
  readonly onHover: (position: number) => void;
  readonly row: Row;
  readonly terms: readonly string[];
}): ReactElement => (
  <Link
    id={`hs-cmd-${props.index}`}
    href={props.row.href}
    role="option"
    aria-selected={props.index === props.highlighted}
    className="hs-cmd-item"
    {...highlightedOf(props.index === props.highlighted)}
    onClick={props.onClose}
    onMouseMove={(): void => {
      props.onHover(props.index);
    }}
  >
    <span className="hs-cmd-lead">{leadOf(props.row.kind)}</span>
    <span className="hs-cmd-body">
      <span className="hs-cmd-line">
        <span className="hs-cmd-title">{highlight(props.row.title, props.terms)}</span>
        <span className="hs-cmd-trail">{props.row.trail}</span>
      </span>
      <Snippet snippet={props.row.snippet} terms={props.terms} />
    </span>
  </Link>
);

const Items = (props: {
  readonly failed: boolean;
  readonly groups: readonly RowGroup[];
  readonly highlighted: number;
  readonly onClose: () => void;
  readonly onHover: (position: number) => void;
  readonly ordered: readonly Row[];
  readonly terms: readonly string[];
}): ReactElement => {
  if (props.failed) {
    return <Unavailable />;
  }

  if (props.groups.length === NONE) {
    return <NoResults />;
  }

  return (
    <>
      {props.groups.map(([heading, group]): ReactElement => (
        <div key={heading} className="hs-cmd-group" role="group" aria-label={heading}>
          <div className="hs-cmd-label">{heading}</div>
          {group.map((row): ReactElement => (
            <ResultItem
              key={row.key}
              highlighted={props.highlighted}
              index={props.ordered.indexOf(row)}
              onClose={props.onClose}
              onHover={props.onHover}
              row={row}
              terms={props.terms}
            />
          ))}
        </div>
      ))}
    </>
  );
};

const Results = (props: {
  readonly failed: boolean;
  readonly groups: readonly RowGroup[];
  readonly highlighted: number;
  readonly list: RefObject<HTMLDivElement | null>;
  readonly onClose: () => void;
  readonly onHover: (position: number) => void;
  readonly ordered: readonly Row[];
  readonly terms: readonly string[];
}): ReactElement => (
  <div id="hs-cmd-list" role="listbox" className="hs-cmd-list" ref={props.list}>
    <Items
      failed={props.failed}
      groups={props.groups}
      highlighted={props.highlighted}
      onClose={props.onClose}
      onHover={props.onHover}
      ordered={props.ordered}
      terms={props.terms}
    />
  </div>
);

const Dialog = (props: {
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
}): ReactElement => (
  <>
    <div className="hs-cmd-backdrop" aria-hidden="true" onClick={props.onClose} />
    <div
      className="hs-cmd-stage"
      onClick={(event): void => {
        if (event.target === event.currentTarget) {
          props.onClose();
        }
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Search docs" className="hs-cmd" onKeyDown={props.onKeyDown}>
        {props.children}
      </div>
    </div>
  </>
);

const Footer = (): ReactElement => (
  <div className="hs-cmd-footer">
    <span className="hs-cmd-hint">
      <kbd className="hs-kbd">↑</kbd>
      <kbd className="hs-kbd">↓</kbd>
      Navigate
    </span>
    <span className="hs-cmd-hint">
      <kbd className="hs-kbd">↵</kbd>
      Open page
    </span>
    <span className="hs-cmd-hint hs-cmd-hint-end">
      <kbd className="hs-kbd">Esc</kbd>
      Close
    </span>
  </div>
);

const PaletteInput = (props: {
  readonly highlighted: number;
  readonly input: RefObject<HTMLInputElement | null>;
  readonly onSearchChange: (search: string) => void;
  readonly search: string;
}): ReactElement => (
  <div className="hs-cmd-input-row">
    <SearchGlyph className="hs-cmd-input-icon" aria-hidden="true" />
    <input
      className="hs-cmd-input"
      placeholder="Search the docs"
      spellCheck={false}
      autoComplete="off"
      ref={props.input}
      role="combobox"
      aria-expanded="true"
      aria-controls="hs-cmd-list"
      aria-activedescendant={`hs-cmd-${props.highlighted}`}
      value={props.search}
      onChange={(event): void => {
        props.onSearchChange(event.target.value);
      }}
    />
    <kbd className="hs-kbd">Esc</kbd>
  </div>
);

export { Dialog, Footer, PaletteInput, Results };

export type { Row, RowGroup };
