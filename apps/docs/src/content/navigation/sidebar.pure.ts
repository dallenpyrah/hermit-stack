import { Array as Arr, Option } from "effect";

import { navigation, welcomeSlug } from "./navigation.pure.ts";
import type { NavigationGroup } from "./navigation.pure.ts";
import { iconOf } from "./page-icons.pure.ts";
import type { IconName } from "./page-icons.pure.ts";

type PageStatus = "built" | "planned";

type PageTitles = (slug: string) => {
  readonly title: string;
  readonly description?: string | undefined;
  readonly status: PageStatus;
};

interface SidebarItem {
  readonly title: string;
  readonly description?: string | undefined;
  readonly href: string;
  readonly icon: IconName;
  readonly planned: boolean;
}

interface SidebarGroup {
  readonly heading: string;
  readonly items: readonly SidebarItem[];
}

interface Sidebar {
  readonly groups: readonly SidebarGroup[];
}

// Shown in the search palette before anything is typed.
const suggestedHrefs: readonly string[] = [
  "/quickstart",
  "/why-hermit-stack",
  "/concepts/layers-and-ports",
  "/reference/conventions",
  "/reference/scripts-and-checks",
];

const FIRST_GROUP = 0;

const itemOf = (titles: PageTitles, slug: string): SidebarItem => {
  const page = titles(slug);

  return {
    description: page.description,
    href: `/${slug}`,
    icon: iconOf(slug),
    planned: page.status === "planned",
    title: page.title,
  };
};

// The Welcome page is not a file in content/, so it joins the first group here.
const pagesOf = (group: NavigationGroup, index: number): readonly string[] => {
  if (index === FIRST_GROUP) {
    return [welcomeSlug, ...group.pages];
  }

  return group.pages;
};

const groupOf = (titles: PageTitles, group: NavigationGroup, index: number): SidebarGroup => ({
  heading: group.group,
  items: pagesOf(group, index).map((slug) => itemOf(titles, slug)),
});

const buildSidebar = (titles: PageTitles): Sidebar => ({
  groups: navigation.map((group, index) => groupOf(titles, group, index)),
});

interface Neighbours {
  readonly next: Option.Option<SidebarItem>;
  readonly previous: Option.Option<SidebarItem>;
}

const STEP = 1;

const neighboursOf = (sidebar: Sidebar, href: string): Neighbours => {
  const items = sidebar.groups.flatMap((group) => group.items);
  const index = Arr.findFirstIndex(items, (entry) => entry.href === href);

  return {
    next: Option.flatMap(index, (at) => Arr.get(items, at + STEP)),
    previous: Option.flatMap(index, (at) => Arr.get(items, at - STEP)),
  };
};

export { buildSidebar, neighboursOf, suggestedHrefs };

export type { PageStatus, PageTitles, Sidebar, SidebarGroup, SidebarItem };
