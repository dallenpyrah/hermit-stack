interface NavigationGroup {
  readonly group: string;
  readonly pages: readonly string[];
}

// The section the sidebar header names. hermit-stack has one, so the header is static rather than a switcher.
const section = {
  description: "Guides and concepts",
  title: "Documentation",
} as const;

const welcomeSlug = "welcome";

// The sidebar, in order. Each slug is a file in content/, and the Welcome page leads the first group.
const navigation: readonly NavigationGroup[] = [
  {
    group: "Get started",
    pages: ["quickstart", "why-hermit-stack", "repository-layout"],
  },
  {
    group: "Core concepts",
    pages: [
      "concepts/layers-and-ports",
      "concepts/contexts",
      "concepts/actors",
      "concepts/one-typed-client",
      "concepts/live-data",
      "concepts/design-system",
    ],
  },
  {
    group: "Guides",
    pages: [
      "guides/add-a-context",
      "guides/swap-an-adapter",
      "guides/add-a-component",
      "guides/testing",
      "guides/feature-flags",
      "guides/notifications-webhooks-and-schedules",
      "guides/telemetry",
      "guides/auth",
      "guides/billing",
      "guides/deploy-targets",
    ],
  },
  {
    group: "Surfaces",
    pages: ["surfaces/web", "surfaces/desktop", "surfaces/mobile", "surfaces/cli", "surfaces/mcp-app"],
  },
  {
    group: "Reference",
    pages: [
      "reference/conventions",
      "reference/lint-rules",
      "reference/boundaries",
      "reference/scripts-and-checks",
      "reference/writing-docs",
    ],
  },
];

const publishedSlugs: readonly string[] = navigation.flatMap((group) => group.pages);

export { navigation, publishedSlugs, section, welcomeSlug };

export type { NavigationGroup };
