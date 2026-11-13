import { defineRule } from "@oxlint/plugins";
import type { Visitor } from "@oxlint/plugins";
import { Option, pipe } from "effect";

import { literalString } from "#oxlint/effect-call-syntax.pure";

const noUnboundedConcurrency = defineRule({
  create(context): Visitor {
    return {
      Property(node): void {
        const isConcurrencyKey = !node.computed && node.key.type === "Identifier" && node.key.name === "concurrency";

        const isUnbounded = pipe(
          literalString(node.value),
          Option.exists((value) => value === "unbounded"),
        );

        if (!isConcurrencyKey || !isUnbounded) {
          return;
        }

        context.report({
          message:
            'Concurrency is "unbounded". The number of fibers, connections or requests then grows with the input, so a large input overloads whatever it calls. Fix: pass a number such as { concurrency: 8 }, or "inherit" to use the caller\'s limit.',
          node,
        });
      },
    };
  },
  meta: { messages: {}, type: "problem" },
});

export { noUnboundedConcurrency };
