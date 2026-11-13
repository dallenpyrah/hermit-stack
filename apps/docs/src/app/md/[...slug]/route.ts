import { renderLandingMarkdown, welcomePage } from "#src/content/navigation/landing-pages.pure.ts";
import { pageBody } from "#src/content/markdown/page-body.build.ts";
import { renderPageMarkdown } from "#src/content/markdown/page-markdown.pure.ts";
import { publishedSlugs, welcomeSlug } from "#src/content/navigation/navigation.pure.ts";
import { siteUrl } from "#src/content/site/site.pure.ts";
import { pageOf, titles } from "#src/content/site/source.config.ts";

interface RouteContext {
  readonly params: Promise<{ readonly slug: readonly string[] }>;
}

export const dynamic = "force-static";

export const dynamicParams = false;

// The export writes each twin to out/md/<slug>; finish-export.cli.ts moves it to out/<slug>.md.
export const generateStaticParams = (): { slug: string[] }[] =>
  [welcomeSlug, ...publishedSlugs].map((slug) => ({ slug: slug.split("/") }));

const markdown = (body: string): Response =>
  new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });

const pageMarkdown = (slug: string): string => {
  const page = pageOf(slug);

  return renderPageMarkdown({
    body: pageBody(slug),
    description: page.data.description,
    origin: siteUrl,
    slug,
    title: page.data.title,
  });
};

export const GET = async (_request: Request, context: RouteContext): Promise<Response> => {
  const { slug: segments } = await context.params;
  const slug = segments.join("/");

  if (slug === welcomeSlug) {
    return markdown(renderLandingMarkdown(siteUrl, welcomePage, titles));
  }

  return markdown(pageMarkdown(slug));
};
