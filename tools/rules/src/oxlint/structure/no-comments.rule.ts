import { defineRule } from "@oxlint/plugins";
import type { ESTree, Visitor } from "@oxlint/plugins";
import { Array as Arr } from "effect";

const safetyNote = /^\s*SAFETY\s*:\s*\S/u;

const compilerDirective = /^\/\s*<(?:reference|amd-module|amd-dependency)\b/u;

const stabilityTag = /^\*\s*@stability\s+(?:stable|unstable|experimental)\s*$/u;

const isRequired = (comment: ESTree.Comment): boolean =>
  comment.type === "Shebang" ||
  (comment.type === "Line" && (safetyNote.test(comment.value) || compilerDirective.test(comment.value))) ||
  (comment.type === "Block" && stabilityTag.test(comment.value));

const noComments = defineRule({
  create(context): Visitor {
    return {
      Program(): void {
        for (const comment of Arr.filter(context.sourceCode.getAllComments(), (found) => !isRequired(found))) {
          context.report({
            message:
              "Comment in code. A comment is not checked, so it drifts from the code it describes, and a reader cannot tell which one is right. Fix: delete it, and put what it said into a name, a type or a test; the comments a checker reads stay: the `// SAFETY: <reason>` line a type assertion needs, and a `/** @stability unstable */` tag alone on its line.",
            node: comment,
          });
        }
      },
    };
  },
  meta: { messages: {}, type: "suggestion" },
});

export { noComments };
