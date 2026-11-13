"use client";

import { Option } from "effect";
import { constVoid } from "effect/Function";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Dispatch, ReactElement, ReactNode, RefObject, SetStateAction } from "react";

import { siteName } from "#src/content/site/site.pure.ts";
import { drawerFocus } from "#src/content/navigation/drawer.pure.ts";
import type { Sidebar as SidebarModel } from "#src/content/navigation/sidebar.pure.ts";
import { NavGlyph, SearchGlyph } from "#src/components/brand/glyphs.view.tsx";
import { SearchPalette } from "#src/components/search/search-palette.view.tsx";
import { Sidebar } from "./sidebar.view.tsx";

type SetDrawer = Dispatch<SetStateAction<boolean>>;

interface DrawerAttribute {
  readonly "data-drawer"?: string;
}

interface SearchToggle {
  readonly closeSearch: () => void;
  readonly openSearch: () => void;
  readonly searching: boolean;
  readonly toggleSearch: () => void;
}

const drawerAttribute = (open: boolean): DrawerAttribute => {
  if (open) {
    return { "data-drawer": "" };
  }

  return {};
};

const useSearchToggle = (): SearchToggle => {
  const [searching, setSearching] = useState(false);
  const searchOpen = useRef(false);
  const searchOrigin = useRef<Option.Option<HTMLElement>>(Option.none());

  const openSearch = (): void => {
    const active = globalThis.document.activeElement;

    searchOrigin.current = Option.none();

    if (active instanceof globalThis.HTMLElement) {
      searchOrigin.current = Option.some(active);
    }

    searchOpen.current = true;
    setSearching(true);
  };

  const closeSearch = (): void => {
    const origin = searchOrigin.current;

    searchOrigin.current = Option.none();
    searchOpen.current = false;
    setSearching(false);

    Option.match(
      Option.filter(origin, (element) => element !== globalThis.document.body && element.isConnected),
      {
        onNone: constVoid,
        onSome: (element): void => {
          element.focus({ preventScroll: true });
        },
      },
    );
  };

  const toggleSearch = (): void => {
    if (searchOpen.current) {
      closeSearch();
    } else {
      openSearch();
    }
  };

  return { closeSearch, openSearch, searching, toggleSearch };
};

const useAutoClose = (pathname: string, setDrawer: SetDrawer): void => {
  useEffect((): void => {
    setDrawer(false);
  }, [pathname]);

  useEffect((): (() => void) => {
    const wide = globalThis.matchMedia("(min-width: 768px)");

    const onChange = (): void => {
      if (wide.matches) {
        setDrawer(false);
      }
    };

    wide.addEventListener("change", onChange);

    return (): void => {
      wide.removeEventListener("change", onChange);
    };
  }, []);
};

const useDrawerFocus = (
  drawer: boolean,
  sidebar: RefObject<HTMLElement | null>,
  opener: RefObject<HTMLButtonElement | null>,
): void => {
  const was = useRef(false);

  useEffect((): void => {
    const focus = drawerFocus(was.current, drawer);

    was.current = drawer;

    if (focus === "enter") {
      sidebar.current?.querySelector<HTMLElement>("a[href], button")?.focus({ preventScroll: true });
    }

    if (focus === "return") {
      opener.current?.focus({ preventScroll: true });
    }
  }, [drawer]);
};

const useShortcuts = (toggleSearch: () => void, setDrawer: SetDrawer): void => {
  useEffect((): (() => void) => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggleSearch();

        return;
      }

      if (event.key === "Escape" && !event.defaultPrevented) {
        setDrawer(false);
      }
    };

    globalThis.addEventListener("keydown", onKeyDown);

    return (): void => {
      globalThis.removeEventListener("keydown", onKeyDown);
    };
  }, []);
};

const MobileBar = (props: {
  readonly drawer: boolean;
  readonly logo: ReactNode;
  readonly opener: RefObject<HTMLButtonElement | null>;
  readonly openSearch: () => void;
  readonly setDrawer: SetDrawer;
}): ReactElement => (
  <header className="hs-mobilebar" inert={props.drawer}>
    <button
      ref={props.opener}
      type="button"
      className="hs-icon-btn"
      aria-label="Open navigation"
      aria-expanded={props.drawer}
      onClick={(): void => {
        props.setDrawer(true);
      }}
    >
      <NavGlyph aria-hidden="true" />
    </button>
    <a className="hs-wordmark" aria-label={`${siteName} docs`} href="/welcome">
      {props.logo}
    </a>
    <button type="button" className="hs-icon-btn" aria-label="Search" onClick={props.openSearch}>
      <SearchGlyph aria-hidden="true" />
    </button>
  </header>
);

export const Shell = (props: {
  readonly logo: ReactNode;
  readonly sidebar: SidebarModel;
  readonly children: ReactNode;
}): ReactElement => {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const { closeSearch, openSearch, searching, toggleSearch } = useSearchToggle();

  const closeDrawer = (): void => {
    setDrawer(false);
  };

  useAutoClose(pathname, setDrawer);
  useDrawerFocus(drawer, sidebar, opener);
  useShortcuts(toggleSearch, setDrawer);

  return (
    <div className="hs-shell" {...drawerAttribute(drawer)}>
      <MobileBar drawer={drawer} logo={props.logo} opener={opener} openSearch={openSearch} setDrawer={setDrawer} />
      <div className="hs-scrim" aria-hidden="true" onClick={closeDrawer} />
      <Sidebar
        ref={sidebar}
        logo={props.logo}
        sidebar={props.sidebar}
        pathname={pathname}
        trapped={drawer && !searching}
        onNavigate={closeDrawer}
        onSearch={openSearch}
      />
      <main id="hs-main" className="hs-main" tabIndex={-1} inert={drawer}>
        {props.children}
      </main>
      <div className="hs-frame" aria-hidden="true" />
      {searching && <SearchPalette sidebar={props.sidebar} onClose={closeSearch} />}
    </div>
  );
};
