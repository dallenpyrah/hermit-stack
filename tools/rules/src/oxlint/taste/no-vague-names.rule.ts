import { defineRule } from "@oxlint/plugins";
import type { Visitor } from "@oxlint/plugins";
import { Array as Arr, Predicate, pipe } from "effect";

const noVagueNames = defineRule({
  create(context): Visitor {
    const vague = new Set(Arr.filter(context.options, Predicate.isString));

    return {
      "Program:exit"(): void {
        const declared = pipe(
          context.sourceCode.scopeManager.scopes,
          Arr.flatMap((scope) => scope.variables),
          Arr.flatMap((variable) => variable.identifiers),
          (identifiers) => Arr.fromIterable(new Set(identifiers)),
          Arr.filter((identifier) => vague.has(identifier.name)),
        );

        for (const identifier of declared) {
          context.report({
            message: `Name "${identifier.name}" says nothing about what it holds. A reader then has to open the code to learn it. Fix: name it after what it is or does.`,
            node: identifier,
          });
        }
      },
    };
  },
  meta: { messages: {}, schema: { items: { type: "string" }, type: "array" }, type: "problem" },
});

export { noVagueNames };
