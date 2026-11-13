import { defineRule } from "@oxlint/plugins";
import type { Visitor } from "@oxlint/plugins";
import { Array as Arr, Option, String as Str, pipe } from "effect";

const grabBagNames = new Set(["common", "helper", "helpers", "misc", "shared", "stuff", "util", "utils"]);

const noGrabBagModules = defineRule({
  create(context): Visitor {
    return {
      Program(node): void {
        const grabBag = pipe(
          context.filename,
          Str.split(/[\\/]/u),
          Arr.flatMap((segment) => pipe(segment, Str.replace(/\.[cm]?[jt]sx?$/u, ""), Str.toLowerCase, Str.split("."))),
          Arr.findFirst((segment) => grabBagNames.has(segment)),
        );

        if (Option.isNone(grabBag)) {
          return;
        }

        context.report({
          message: `Module path uses the grab-bag name "${grabBag.value}". Such modules collect unrelated code and never get split. Fix: name the module after the one thing it provides.`,
          node,
        });
      },
    };
  },
  meta: { messages: {}, type: "problem" },
});

export { noGrabBagModules };
