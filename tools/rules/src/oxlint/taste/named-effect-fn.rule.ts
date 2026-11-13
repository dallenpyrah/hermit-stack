import { defineRule } from "@oxlint/plugins";
import type { Visitor } from "@oxlint/plugins";
import { Option } from "effect";

import { isEffectMember, stringArgument } from "#oxlint/effect-call-syntax.pure";

const namedEffectFn = defineRule({
  create(context): Visitor {
    return {
      CallExpression(node): void {
        if (!isEffectMember(["fn"])(node.callee) || Option.isSome(stringArgument(node))) {
          return;
        }

        context.report({
          message:
            'Effect.fn has no span name. Traces and stack frames show the call as anonymous. Fix: write Effect.fn("bindingName")(function* ...), or use Effect.fnUntraced when no span is wanted.',
          node,
        });
      },
    };
  },
  meta: { messages: {}, type: "problem" },
});

export { namedEffectFn };
