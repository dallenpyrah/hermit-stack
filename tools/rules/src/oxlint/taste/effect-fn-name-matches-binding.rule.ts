import { defineRule } from "@oxlint/plugins";
import type { Visitor } from "@oxlint/plugins";
import { Option, String as Str, pipe } from "effect";

import { bindingName, isEffectMember, stringArgument } from "#oxlint/effect-call-syntax.pure";

const effectFnNameMatchesBinding = defineRule({
  create(context): Visitor {
    return {
      CallExpression(node): void {
        const applied = node.parent;

        if (!isEffectMember(["fn"])(node.callee) || applied.type !== "CallExpression" || applied.callee !== node) {
          return;
        }

        const mismatch = pipe(
          Option.all({
            binding: bindingName(applied)(applied.parent),
            spanName: stringArgument(node),
          }),
          Option.filter(({ binding, spanName }) => spanName !== binding && !Str.endsWith(`.${binding}`)(spanName)),
        );

        if (Option.isNone(mismatch)) {
          return;
        }

        const { binding, spanName } = mismatch.value;

        context.report({
          message: `Span name "${spanName}" does not match the binding "${binding}". Traces then name a function that does not exist in the code. Fix: use "${binding}", or "Owner.${binding}" for a service method.`,
          node,
        });
      },
    };
  },
  meta: { messages: {}, type: "problem" },
});

export { effectFnNameMatchesBinding };
