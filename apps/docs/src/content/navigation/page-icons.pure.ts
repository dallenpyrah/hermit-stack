import { Option } from "effect";

const iconNames = [
  "activity",
  "app-window",
  "arrow-right-left",
  "bell",
  "book-open",
  "boxes",
  "braces",
  "cloud-upload",
  "component",
  "cpu",
  "credit-card",
  "file-code",
  "flag",
  "flask-conical",
  "folder-tree",
  "gauge",
  "globe",
  "key-round",
  "layers",
  "list-checks",
  "list-todo",
  "monitor",
  "network",
  "palette",
  "rocket",
  "shield-check",
  "smartphone",
  "square-plus",
  "terminal",
  "zap",
] as const;

type IconName = (typeof iconNames)[number];

const iconBySlug = {
  "concepts/actors": "cpu",
  "concepts/contexts": "boxes",
  "concepts/design-system": "palette",
  "concepts/layers-and-ports": "layers",
  "concepts/live-data": "activity",
  "concepts/one-typed-client": "braces",
  "guides/add-a-component": "component",
  "guides/add-a-context": "square-plus",
  "guides/auth": "key-round",
  "guides/billing": "credit-card",
  "guides/deploy-targets": "cloud-upload",
  "guides/feature-flags": "flag",
  "guides/notifications-webhooks-and-schedules": "bell",
  "guides/swap-an-adapter": "arrow-right-left",
  "guides/telemetry": "gauge",
  "guides/testing": "flask-conical",
  quickstart: "zap",
  "reference/boundaries": "network",
  "reference/conventions": "file-code",
  "reference/lint-rules": "shield-check",
  "reference/scripts-and-checks": "list-todo",
  "reference/writing-docs": "book-open",
  "repository-layout": "folder-tree",
  "surfaces/cli": "terminal",
  "surfaces/desktop": "monitor",
  "surfaces/mcp-app": "app-window",
  "surfaces/mobile": "smartphone",
  "surfaces/web": "globe",
  welcome: "rocket",
  "why-hermitstack": "list-checks",
} as const satisfies Readonly<Record<string, IconName>>;

const pageIcons: ReadonlyMap<string, IconName> = new Map(Object.entries(iconBySlug));

const iconOf = (slug: string): IconName => {
  const icon = Option.fromNullishOr(pageIcons.get(slug));

  if (Option.isNone(icon)) {
    throw new Error(`No icon for ${slug}; add it to iconBySlug in page-icons.pure.ts`);
  }

  return icon.value;
};

const sectionIcon: IconName = "book-open";

export { iconNames, iconOf, pageIcons, sectionIcon };

export type { IconName };
