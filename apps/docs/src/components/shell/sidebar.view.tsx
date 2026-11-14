"use client";

import { FocusScope } from "@radix-ui/react-focus-scope";
import Link from "next/link";
import type { ReactElement, ReactNode, Ref } from "react";

import { section } from "#src/content/navigation/navigation.pure.ts";
import { sectionIcon } from "#src/content/navigation/page-icons.pure.ts";
import type { Sidebar as SidebarModel, SidebarGroup, SidebarItem } from "#src/content/navigation/sidebar.pure.ts";
import { repositoryUrl, siteName } from "#src/content/site/site.pure.ts";
import { ExternalGlyph, SearchGlyph } from "#src/components/brand/glyphs.view.tsx";
import { GitHubMark, PageIcon } from "#src/components/brand/icons.view.tsx";
import { AppearanceMenu } from "./appearance-menu.view.tsx";

const routeOf = (pathname: string): string => {
  if (pathname === "/") {
    return "/welcome";
  }

  return pathname;
};

interface ActiveAttribute {
  readonly "data-active"?: string;
}

const activeOf = (active: boolean): ActiveAttribute => {
  if (active) {
    return { "data-active": "true" };
  }

  return {};
};

const PlannedBadge = (props: { readonly item: SidebarItem }): ReactNode => {
  if (props.item.planned) {
    return <span className="hs-badge">Planned</span>;
  }

  return [];
};

const Rows = (props: { readonly group: SidebarGroup; readonly route: string }): ReactElement => (
  <div className="hs-group">
    {props.group.items.map((item): ReactElement => (
      <Link key={item.href} className="hs-row" href={item.href} {...activeOf(item.href === props.route)}>
        <PageIcon name={item.icon} />
        <span className="hs-row-label">{item.title}</span>
        <PlannedBadge item={item} />
      </Link>
    ))}
  </div>
);

const NavGroup = (props: { readonly group: SidebarGroup; readonly route: string }): ReactElement => (
  <div className="hs-section-group">
    <p className="hs-section-head">
      <span className="hs-row-label">{props.group.heading}</span>
    </p>
    <Rows group={props.group} route={props.route} />
  </div>
);

const Nav = (props: { readonly sidebar: SidebarModel; readonly route: string }): ReactElement => (
  <nav className="hs-nav" aria-label={section.title}>
    {props.sidebar.groups.map((group): ReactElement => (
      <NavGroup key={group.heading} group={group} route={props.route} />
    ))}
  </nav>
);

const SectionHeader = (): ReactElement => (
  <div className="hs-section-select">
    <div className="hs-section-trigger" data-static="">
      <span className="hs-section-tile">
        <PageIcon name={sectionIcon} />
      </span>
      <span className="hs-section-text">
        <span className="hs-section-title">{section.title}</span>
        <span className="hs-section-desc">{section.description}</span>
      </span>
    </div>
  </div>
);

const Foot = (): ReactElement => (
  <div className="hs-group hs-sidebar-foot">
    <AppearanceMenu />
    <div className="hs-foot-row">
      <a className="hs-row" href={repositoryUrl}>
        <ExternalGlyph className="hs-icon" aria-hidden="true" />
        <span className="hs-row-label">Open {siteName}</span>
      </a>
      <a className="hs-icon-btn" href={repositoryUrl} aria-label={`${siteName} on GitHub`}>
        <GitHubMark />
      </a>
    </div>
  </div>
);

export const Sidebar = (props: {
  readonly ref: Ref<HTMLElement>;
  readonly logo: ReactNode;
  readonly sidebar: SidebarModel;
  readonly pathname: string;
  readonly trapped: boolean;
  readonly onNavigate: () => void;
  readonly onSearch: () => void;
}): ReactElement => {
  const route = routeOf(props.pathname);

  return (
    <FocusScope
      asChild
      trapped={props.trapped}
      loop={props.trapped}
      onMountAutoFocus={(event): void => {
        event.preventDefault();
      }}
      onUnmountAutoFocus={(event): void => {
        event.preventDefault();
      }}
    >
      <aside
        ref={props.ref}
        className="hs-sidebar"
        onClick={(event): void => {
          if (event.target instanceof globalThis.Element && event.target.closest("a[href]") !== null) {
            props.onNavigate();
          }
        }}
      >
        <div className="hs-brand">
          <Link className="hs-wordmark" aria-label={`${siteName} docs`} href="/welcome">
            {props.logo}
          </Link>
        </div>
        <SectionHeader />
        <button type="button" className="hs-search-btn" onClick={props.onSearch}>
          <SearchGlyph className="hs-icon" aria-hidden="true" />
          <span>Search</span>
          <kbd className="hs-kbd">⌘K</kbd>
        </button>
        <Nav sidebar={props.sidebar} route={route} />
        <Foot />
      </aside>
    </FocusScope>
  );
};
