import { defineRule } from "@oxlint/plugins";
import type { ESTree, Visitor } from "@oxlint/plugins";
import { Array as Arr, Option, Record as Rec, Schema, String as Str, pipe } from "effect";

import { literalString, stringArgument } from "#oxlint/effect-call-syntax.pure";

import { vendorSdks } from "./vendor-sdks.pure.js";

const VendorImportsOptions = Schema.Struct({ use: Schema.Record(Schema.String, Schema.String) });

const matches = (vendor: string, specifier: string): boolean => {
  if (Str.endsWith("/")(vendor)) {
    return Str.startsWith(vendor)(specifier);
  }

  return specifier === vendor || Str.startsWith(`${vendor}/`)(specifier);
};

const vendorImports = defineRule({
  create(context): Visitor {
    const { use } = pipe(
      Arr.head(context.options),
      Option.flatMap(Schema.decodeUnknownOption(VendorImportsOptions)),
      Option.getOrElse(() => ({ use: vendorSdks })),
    );

    const check = (node: ESTree.Node, specifier: Option.Option<string>): void => {
      if (Option.isNone(specifier)) {
        return;
      }

      const replacement = pipe(
        Rec.toEntries(use),
        Arr.findFirst(([vendor]) => matches(vendor, specifier.value)),
        Option.map(([, target]) => target),
      );

      if (Option.isSome(replacement)) {
        context.report({
          message: `This file imports the vendor SDK "${specifier.value}". Every service with a Distilled SDK or an Alchemy provider is reached through it, so clients share typed errors, retries and telemetry. Fix: import ${replacement.value}.`,
          node,
        });
      }
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
    schema: [
      {
        additionalProperties: false,
        properties: { use: { additionalProperties: { type: "string" }, type: "object" } },
        type: "object",
      },
    ],
    type: "problem",
  },
});

export { vendorImports };
