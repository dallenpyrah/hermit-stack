import { defineRule } from "@oxlint/plugins";
import type { Visitor } from "@oxlint/plugins";

const noTypePredicates = defineRule({
  create(context): Visitor {
    return {
      TSTypePredicate(node): void {
        context.report({
          message:
            "Hand-written type guard. TypeScript trusts it without checking, so a wrong guard misleads every caller. Fix: use Schema.is(SomeSchema) or compose guards from the Predicate module.",
          node,
        });
      },
    };
  },
  meta: { messages: {}, type: "problem" },
});

export { noTypePredicates };
