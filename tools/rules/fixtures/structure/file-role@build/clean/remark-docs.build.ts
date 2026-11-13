import type { Root } from "mdast";
import { visit } from "unist-util-visit";

import { pageExists } from "./repository.build.ts";

export const remarkDeadLinks = () => (tree: Root) => {
  visit(tree, "link", (node) => {
    if (!pageExists(node.url)) {
      throw new Error(`Dead link: ${node.url}`);
    }
  });
};
