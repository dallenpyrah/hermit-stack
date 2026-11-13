import { defineRule } from "@oxlint/plugins";
import type { Visitor } from "@oxlint/plugins";

import { isEffectMember } from "#oxlint/effect-call-syntax.pure";

const noPipeOnEffectFn = defineRule({
  create(context): Visitor {
    return {
      MemberExpression(node): void {
        const target = node.object;

        if (
          node.computed ||
          node.property.type !== "Identifier" ||
          node.property.name !== "pipe" ||
          target.type !== "CallExpression"
        ) {
          return;
        }

        const isNamedApplication =
          target.callee.type === "CallExpression" && isEffectMember(["fn"])(target.callee.callee);

        if (!isNamedApplication && !isEffectMember(["fn", "fnUntraced"])(target.callee)) {
          return;
        }

        context.report({
          message:
            'Combinators are piped onto an Effect.fn result. They then wrap the returned function instead of each call\'s effect. Fix: pass them as extra arguments, as in Effect.fn("name")(function* ..., Effect.orDie).',
          node,
        });
      },
    };
  },
  meta: { messages: {}, type: "problem" },
});

export { noPipeOnEffectFn };
