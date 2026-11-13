import type { Metadata } from "next";

import { markdownBullet, pageUrl } from "#src/content/markdown/page-markdown.pure.ts";
import { siteDescription } from "#src/content/site/site.pure.ts";

const TRIPLE = 3;

const PAIR = 2;

type CardVariant = "feature" | "compact";

interface LandingSection {
  readonly cards: readonly string[];
  readonly columns: typeof PAIR | typeof TRIPLE;
  readonly variant: CardVariant;
  readonly heading: string;
}

interface LandingPage {
  readonly description: string;
  readonly lead: string;
  readonly tagline: string;
  readonly sections: readonly LandingSection[];
  readonly slug: string;
  readonly title: string;
}

// Each card is a page slug; its title, icon and one-sentence description come from that page.
const welcomePage: LandingPage = {
  description: siteDescription,
  lead: "hermitstack is one Effect program you fork to start a product. The crab is the part that never changes: Effect, FoldKit, Alchemy, StyleX and Oxlint. The shell is everything a fork swaps: the host that runs your actors, the cloud it runs on, and every vendor behind a port. Moving into a new shell is a Layer, not a rewrite.",
  sections: [
    {
      cards: ["quickstart", "why-hermitstack", "repository-layout", "reference/scripts-and-checks"],
      columns: PAIR,
      heading: "Start here",
      variant: "feature",
    },
    {
      cards: [
        "concepts/layers-and-ports",
        "concepts/contexts",
        "concepts/actors",
        "concepts/one-typed-client",
        "concepts/live-data",
        "concepts/design-system",
      ],
      columns: TRIPLE,
      heading: "Core concepts",
      variant: "feature",
    },
    {
      cards: [
        "guides/add-a-context",
        "guides/swap-an-adapter",
        "guides/testing",
        "guides/deploy-targets",
        "guides/feature-flags",
        "guides/telemetry",
      ],
      columns: TRIPLE,
      heading: "Guides",
      variant: "compact",
    },
    {
      cards: ["surfaces/web", "surfaces/desktop", "surfaces/mobile", "surfaces/cli", "surfaces/mcp-app"],
      columns: TRIPLE,
      heading: "Surfaces",
      variant: "compact",
    },
  ],
  slug: "welcome",
  tagline: "Same crab, new shell.",
  title: "Welcome to hermitstack",
};

interface CardText {
  readonly title: string;
  readonly description?: string | undefined;
}

const renderLandingMarkdown = (origin: string, page: LandingPage, describe: (slug: string) => CardText): string =>
  [
    `# ${page.title}`,
    `> ${page.description}`,
    `Source: ${pageUrl(origin, page.slug)}`,
    `${page.tagline} ${page.lead}`,
    ...page.sections.map((section) =>
      [
        `## ${section.heading}`,
        ...section.cards.map((slug) => markdownBullet({ ...describe(slug), origin, slug })),
      ].join("\n"),
    ),
  ]
    .join("\n\n")
    .concat("\n");

const landingMetadata = (origin: string, page: LandingPage): Metadata => ({
  alternates: { canonical: pageUrl(origin, page.slug) },
  description: page.description,
  openGraph: {
    description: page.description,
    title: page.title,
    url: pageUrl(origin, page.slug),
  },
  title: page.title,
});

export { landingMetadata, renderLandingMarkdown, welcomePage };

export type { CardVariant, LandingPage, LandingSection };
