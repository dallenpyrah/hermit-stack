import { defineRule } from "@oxlint/plugins";
import type { Visitor } from "@oxlint/plugins";
import { Option, String as Str, pipe } from "effect";

import { isErrorFactory } from "#oxlint/effect-call-syntax.pure";

const taggedErrorSuffix = defineRule({
  create(context): Visitor {
    return {
      ClassDeclaration(node): void {
        const className = pipe(
          Option.fromNullishOr(node.id),
          Option.map((id) => id.name),
          Option.filter((name) => !Str.endsWith("Error")(name)),
        );

        if (!isErrorFactory(node.superClass) || Option.isNone(className)) {
          return;
        }

        context.report({
          message: `Error class "${className.value}" does not end in Error. Call sites such as catchTag("${className.value}") then read like success values. Fix: rename it to "${className.value}Error".`,
          node,
        });
      },
    };
  },
  meta: { messages: {}, type: "problem" },
});

export { taggedErrorSuffix };
