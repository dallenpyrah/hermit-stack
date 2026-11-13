import { Predicate } from "effect";
import GithubSlugger from "github-slugger";

interface Heading {
  readonly level: number;
  readonly text: string;
}

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/u;

const FENCE = /^\s*(?<marker>`{3,}|~{3,})/u;

const HEADING = /^(?<hashes>#{1,6})\s+(?<text>.+?)\s*#*\s*$/u;

const LINK = /\[(?<label>[^\]]*)\]\([^)]*\)/gu;

const CODE_SPAN = /`(?<code>[^`]*)`/gu;

const EMPHASIS = /(?<mark>\*\*|__|\*|_)(?<inner>.+?)\k<mark>/gu;

const NO_FENCE = "";

const NONE = 0;

const stripFrontmatter = (text: string): string => text.replace(FRONTMATTER, "");

const plainHeading = (raw: string): string =>
  raw.replaceAll(LINK, "$<label>").replaceAll(CODE_SPAN, "$<code>").replaceAll(EMPHASIS, "$<inner>").trim();

const closesFence = (fence: string, marker: string): boolean =>
  marker.startsWith(fence.charAt(NONE)) && marker.length >= fence.length;

const nextFence = (fence: string, marker: string): string => {
  if (fence === NO_FENCE) {
    return marker;
  }

  if (closesFence(fence, marker)) {
    return NO_FENCE;
  }

  return fence;
};

const headingOf = (line: string): readonly Heading[] => {
  const heading = HEADING.exec(line)?.groups;

  if (Predicate.isUndefined(heading)) {
    return [];
  }

  return [{ level: heading.hashes?.length ?? NONE, text: plainHeading(heading.text ?? "") }];
};

const headingsOutsideFences = (text: string): readonly Heading[] => {
  const found: Heading[] = [];
  let fence = NO_FENCE;

  for (const line of stripFrontmatter(text).split(/\r?\n/u)) {
    const marker = FENCE.exec(line)?.groups?.marker;

    if (Predicate.isNotUndefined(marker)) {
      fence = nextFence(fence, marker);
    } else if (fence === NO_FENCE) {
      found.push(...headingOf(line));
    }
  }

  return found;
};

const headingAnchors = (text: string): ReadonlySet<string> => {
  const slugger = new GithubSlugger();

  return new Set(headingsOutsideFences(text).map((heading) => slugger.slug(heading.text)));
};

export { headingAnchors, stripFrontmatter };
