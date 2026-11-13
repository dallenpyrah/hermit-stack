import { Option } from "effect";

import { headingAnchors } from "./headings.build.ts";
import type { LinkEnvironment } from "./links.pure.ts";
import { publishedSlugs, welcomeSlug } from "#src/content/navigation/navigation.pure.ts";
import { pathKind, readRepositoryFile } from "./repository.build.ts";
import { contentPath } from "#src/content/site/site.pure.ts";

const published = new Set(publishedSlugs);

const linkEnvironment: LinkEnvironment = {
  anchors: (slug) => {
    if (!published.has(slug)) {
      return Option.getOrUndefined(Option.none());
    }

    return headingAnchors(readRepositoryFile(`${contentPath}/${slug}.md`));
  },
  kind: pathKind,
  routes: new Set([...published, welcomeSlug]),
};

export { linkEnvironment };
