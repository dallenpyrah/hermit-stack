import { defineRule } from "@oxlint/plugins";
import type { ESTree, Visitor } from "@oxlint/plugins";
import { Array as Arr, Option, String as Str, pipe } from "effect";

import { literalString } from "#oxlint/effect-call-syntax.pure";

const minimumSentences = 3;

const followsReportFormat = (text: string): boolean => {
  const sentences = pipe(text, Str.split(/(?<=\.)\s+/u));

  return (
    sentences.length >= minimumSentences &&
    pipe(Arr.lastNonEmpty(sentences), Str.startsWith("Fix: ")) &&
    pipe(text, Str.endsWith("."))
  );
};

const messageText = (value: ESTree.Node): Option.Option<string> => {
  if (value.type === "TemplateLiteral") {
    return Option.some(
      pipe(
        value.quasis,
        Arr.map((quasi) => quasi.value.cooked ?? ""),
        Arr.join("X"),
      ),
    );
  }

  return literalString(value);
};

const isReportCall = (holder: ESTree.Node): boolean =>
  holder.type === "CallExpression" &&
  holder.callee.type === "MemberExpression" &&
  !holder.callee.computed &&
  holder.callee.property.type === "Identifier" &&
  holder.callee.property.name === "report";

const reportMessageFormat = defineRule({
  create(context): Visitor {
    return {
      Property(node): void {
        const objectLiteral = node.parent;
        const isMessageKey = !node.computed && node.key.type === "Identifier" && node.key.name === "message";

        if (!isMessageKey || objectLiteral.type !== "ObjectExpression" || !isReportCall(objectLiteral.parent)) {
          return;
        }

        const text = messageText(node.value);

        if (Option.isNone(text) || followsReportFormat(text.value)) {
          return;
        }

        context.report({
          message:
            'Lint message does not follow "<what>. <why>. Fix: <step>.". Readers then see a complaint without a reason or a next step. Fix: rewrite it as three sentences, the last starting with Fix:.',
          node,
        });
      },
    };
  },
  meta: { messages: {}, type: "problem" },
});

export { reportMessageFormat };
