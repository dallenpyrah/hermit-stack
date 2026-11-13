import { defineRule } from "@oxlint/plugins";
import type { ESTree, Visitor } from "@oxlint/plugins";
import { Array as Arr, Option, Record as Rec, pipe } from "effect";

import { literalString, stringArgument } from "#oxlint/effect-call-syntax.pure";

const barrels = {
  "@effect/platform-bun": "BunRuntime",
  "@effect/platform-node": "NodeRuntime",
} as const satisfies Readonly<Record<string, string>>;

const moduleNames = (node: ESTree.Node): readonly string[] => {
  if (node.type === "ImportDeclaration") {
    return Arr.flatMap(node.specifiers, (specifier) => {
      if (specifier.type === "ImportSpecifier" && specifier.imported.type === "Identifier") {
        return [specifier.imported.name];
      }

      return [];
    });
  }

  if (node.type === "ExportNamedDeclaration") {
    return Arr.flatMap(node.specifiers, (specifier) => {
      if (specifier.local.type === "Identifier") {
        return [specifier.local.name];
      }

      return [];
    });
  }

  return [];
};

const barrelImports = defineRule({
  create(context): Visitor {
    const check = (node: ESTree.Node, specifier: Option.Option<string>): void => {
      const barrel = pipe(
        specifier,
        Option.flatMap((source) => Arr.findFirst(Rec.toEntries(barrels), ([name]) => name === source)),
      );

      if (Option.isNone(barrel)) {
        return;
      }

      const [source, example] = barrel.value;

      const fix = Arr.match(moduleNames(node), {
        onEmpty: () => `each module by its path, such as "${source}/${example}"`,
        onNonEmpty: (names) =>
          Arr.join(
            Arr.map(names, (name) => `"${source}/${name}"`),
            ", ",
          ),
      });

      context.report({
        message: `This file imports the root of "${source}". Its barrel loads every module in the package, its Redis client included, so the process loads modules it never uses. Fix: import ${fix}.`,
        node,
      });
    };

    return {
      CallExpression(node): void {
        if (node.callee.type === "Identifier" && node.callee.name === "require") {
          check(node, stringArgument(node));
        }
      },
      ExportAllDeclaration(node): void {
        check(node, Option.some(node.source.value));
      },
      ExportNamedDeclaration(node): void {
        if (node.source !== null) {
          check(node, Option.some(node.source.value));
        }
      },
      ImportDeclaration(node): void {
        check(node, Option.some(node.source.value));
      },
      ImportExpression(node): void {
        check(node, literalString(node.source));
      },
    };
  },
  meta: {
    messages: {},
    schema: [],
    type: "problem",
  },
});

export { barrelImports };
