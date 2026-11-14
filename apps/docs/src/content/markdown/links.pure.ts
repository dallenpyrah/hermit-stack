import { Option } from "effect";

import { contentPath, repositoryLink } from "#src/content/site/site.pure.ts";

interface LinkEnvironment {
  readonly routes: ReadonlySet<string>;
  readonly kind: (repositoryPath: string) => "file" | "directory" | undefined;
  readonly anchors: (slug: string) => ReadonlySet<string> | undefined;
}

type LinkResolution = { readonly href: string } | { readonly problem: string };

interface LinkRequest {
  readonly environment: LinkEnvironment;
  readonly source: string;
  readonly href: string;
}

interface AnchorRequest {
  readonly environment: LinkEnvironment;
  readonly slug: string;
  readonly href: string;
  readonly fragment: string;
}

interface FragmentSplit {
  readonly fragment: string;
  readonly path: string;
}

interface RelativeRequest {
  readonly environment: LinkEnvironment;
  readonly source: string;
  readonly path: string;
  readonly fragment: string;
}

const SCHEME = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu;

const EDGE_SLASHES = /^\/+|\/+$/gu;

const OUTSIDE = "..";

const MARKDOWN_EXTENSION = ".md";

const NONE = 0;

const LAST = -1;

const AFTER_HASH = 1;

const slugOfTarget = (target: string): Option.Option<string> => {
  const prefix = `${contentPath}/`;

  if (target.startsWith(prefix) && target.endsWith(MARKDOWN_EXTENSION)) {
    return Option.some(target.slice(prefix.length, -MARKDOWN_EXTENSION.length));
  }

  return Option.none();
};

const isSkippable = (segment: string): boolean => segment === "." || segment === "";

const climbs = (kept: readonly string[]): boolean => kept.length === NONE || kept.at(LAST) === OUTSIDE;

const normalize = (path: string): string => {
  const kept: string[] = [];

  for (const segment of path.split("/")) {
    if (segment !== OUTSIDE) {
      if (!isSkippable(segment)) {
        kept.push(segment);
      }
    } else if (climbs(kept)) {
      kept.push(segment);
    } else {
      kept.pop();
    }
  }

  return kept.join("/");
};

const fragmentSuffix = (fragment: string): string => {
  if (fragment === "") {
    return "";
  }

  return `#${fragment}`;
};

const splitFragment = (href: string): FragmentSplit => {
  const hashAt = href.indexOf("#");

  if (hashAt === LAST) {
    return { fragment: "", path: href };
  }

  return { fragment: href.slice(hashAt + AFTER_HASH), path: href.slice(NONE, hashAt) };
};

const withAnchor = (input: AnchorRequest): LinkResolution => {
  if (input.fragment === "") {
    return { href: input.href };
  }

  const anchors = Option.fromNullishOr(input.environment.anchors(input.slug));

  if (Option.isNone(anchors) || anchors.value.has(input.fragment)) {
    return { href: input.href };
  }

  return { problem: `#${input.fragment} is not a heading of ${input.slug}` };
};

const routeLink = (environment: LinkEnvironment, slug: string, fragment: string): LinkResolution =>
  withAnchor({ environment, fragment, href: `/${slug}${fragmentSuffix(fragment)}`, slug });

const absoluteLink = (environment: LinkEnvironment, path: string, fragment: string): LinkResolution => {
  const slug = path.replaceAll(EDGE_SLASHES, "");

  if (!environment.routes.has(slug)) {
    return { problem: `${path} is not a published page` };
  }

  return routeLink(environment, slug, fragment);
};

const repositoryTarget = (input: RelativeRequest, target: string): LinkResolution => {
  const kind = Option.fromNullishOr(input.environment.kind(target));

  if (Option.isNone(kind)) {
    return { problem: `${input.path} does not exist (${target})` };
  }

  return {
    href: `${repositoryLink({ directory: kind.value === "directory", path: target })}${fragmentSuffix(input.fragment)}`,
  };
};

const relativeLink = (input: RelativeRequest): LinkResolution => {
  const directory = `${contentPath}/${input.source}${MARKDOWN_EXTENSION}`.split("/").slice(NONE, LAST).join("/");
  const target = normalize(`${directory}/${input.path}`);

  if (target.startsWith(OUTSIDE)) {
    return { problem: `${input.path} leaves the repository` };
  }

  const slug = slugOfTarget(target);

  if (Option.isSome(slug) && input.environment.routes.has(slug.value)) {
    return routeLink(input.environment, slug.value, input.fragment);
  }

  return repositoryTarget(input, target);
};

const resolveLink = (input: LinkRequest): LinkResolution => {
  const { environment, source, href } = input;

  if (SCHEME.test(href)) {
    return { href };
  }

  const { fragment, path } = splitFragment(href);

  if (path === "") {
    return withAnchor({ environment, fragment, href, slug: source });
  }

  if (path.startsWith("/")) {
    return absoluteLink(environment, path, fragment);
  }

  return relativeLink({ environment, fragment, path, source });
};

export { resolveLink };

export type { LinkEnvironment };
