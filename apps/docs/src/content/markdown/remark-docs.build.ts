import { Option, Predicate } from "effect";
import type { Blockquote, Html, Root } from "mdast";
import path from "node:path";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Transformer } from "unified";
import { visit } from "unist-util-visit";

import { linkEnvironment } from "./link-environment.build.ts";
import { resolveLink } from "./links.pure.ts";
import type { LinkEnvironment } from "./links.pure.ts";
import { docsDirectory } from "./repository.build.ts";

const ADMONITION = /^<(?<tag>Note|Info|Tip|Check|Warning)>\s*(?<body>[\s\S]*?)\s*<\/\k<tag>>$/u;

const MARKDOWN_EXTENSION = /\.md$/u;

const NONE = 0;

const MDAST_DATA = "data";

const DEFAULT_CALLOUT = "info";

const CALLOUT_TYPES = new Map([
  ["Note", "info"],
  ["Info", "info"],
  ["Tip", "idea"],
  ["Check", "success"],
  ["Warning", "warning"],
]);

const calloutOf = (tag: string, body: string): Blockquote => {
  const blocks = unified()
    .use(remarkParse)
    .parse(body)
    .children.filter(
      (node) =>
        node.type === "blockquote" ||
        node.type === "code" ||
        node.type === "heading" ||
        node.type === "html" ||
        node.type === "list" ||
        node.type === "paragraph" ||
        node.type === "table" ||
        node.type === "thematicBreak" ||
        node.type === "definition" ||
        node.type === "footnoteDefinition",
    );

  return {
    [MDAST_DATA]: { hName: "callout", hProperties: { type: CALLOUT_TYPES.get(tag) ?? DEFAULT_CALLOUT } },
    children: blocks,
    type: "blockquote",
  };
};

const remarkAdmonitionTags = (): Transformer<Root> => (tree) => {
  visit(tree, "html", (node: Html, index, parent) => {
    const matched = ADMONITION.exec(node.value.trim());

    const found = Option.all({
      index: Option.fromNullishOr(index),
      match: Option.fromNullishOr(matched),
      parent: Option.fromNullishOr(parent),
    });

    if (Option.isNone(found)) {
      return;
    }

    const { groups } = found.value.match;

    found.value.parent.children[found.value.index] = calloutOf(groups?.tag ?? "", groups?.body ?? "");
  });
};

const remarkDocsLinks = (): Transformer<Root> => (tree, file) => {
  const source = path.relative(docsDirectory, file.path).replace(MARKDOWN_EXTENSION, "");
  const problems: string[] = [];
  const { _compiler: compiler } = file.data;

  const environment: LinkEnvironment = {
    ...linkEnvironment,
    anchors: (slug) => {
      const anchors = linkEnvironment.anchors(slug);

      if (Predicate.isNotUndefined(anchors)) {
        compiler?.addDependency(path.join(docsDirectory, `${slug}.md`));
      }

      return anchors;
    },
  };

  visit(tree, (node) => {
    if (node.type !== "link" && node.type !== "definition") {
      return;
    }

    const resolution = resolveLink({ environment, href: node.url, source });

    if ("problem" in resolution) {
      problems.push(`${node.url}: ${resolution.problem}`);

      return;
    }

    node.url = resolution.href;
  });

  if (problems.length > NONE) {
    throw new Error(`Dead links in apps/docs/content/${source}.md:\n${problems.join("\n")}`);
  }
};

export { remarkAdmonitionTags, remarkDocsLinks };
