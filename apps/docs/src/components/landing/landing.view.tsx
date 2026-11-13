import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import type { CardVariant, LandingPage } from "#src/content/navigation/landing-pages.pure.ts";
import { iconOf } from "#src/content/navigation/page-icons.pure.ts";
import { titles } from "#src/content/site/source.config.ts";
import { PageIcon } from "#src/components/brand/icons.view.tsx";
import { H2 } from "#src/components/mdx/headings.view.tsx";
import { PageFooter } from "#src/components/shell/page-footer.view.tsx";
import { HeroArt } from "./hero-art.view.tsx";

const anchorOf = (heading: string): string => heading.toLowerCase().replaceAll(" ", "-");

const CardBody = (props: { readonly slug: string; readonly variant: CardVariant }): ReactNode => {
  if (props.variant !== "feature") {
    return [];
  }

  return (
    <span className="hs-card-body">
      <p>{titles(props.slug).description}</p>
    </span>
  );
};

const Card = (props: { readonly slug: string; readonly variant: CardVariant }): ReactElement => (
  <Link className="hs-card" data-variant={props.variant} href={`/${props.slug}`}>
    <span className="hs-card-icon">
      <PageIcon name={iconOf(props.slug)} />
    </span>
    <span className="hs-card-text">
      <span className="hs-card-title">{titles(props.slug).title}</span>
      <CardBody slug={props.slug} variant={props.variant} />
    </span>
  </Link>
);

const Sections = (props: { readonly page: LandingPage }): ReactElement => (
  <>
    {props.page.sections.map((section): ReactElement => (
      <section key={section.heading} className="hs-section">
        <H2 id={anchorOf(section.heading)}>{section.heading}</H2>
        <div className="hs-cards" data-cols={section.columns} data-variant={section.variant}>
          {section.cards.map((slug): ReactElement => (
            <Card key={slug} slug={slug} variant={section.variant} />
          ))}
        </div>
      </section>
    ))}
  </>
);

export const Landing = (props: { readonly page: LandingPage }): ReactElement => (
  <article className="hs-page hs-landing" data-kind="landing">
    <header className="hs-head">
      <h1 className="hs-title">{props.page.title}</h1>
    </header>
    <p className="hs-lead">
      <strong>{props.page.tagline}</strong> {props.page.lead}
    </p>
    <HeroArt />
    <div className="hs-prose">
      <Sections page={props.page} />
    </div>
    <PageFooter slug={props.page.slug} />
  </article>
);
