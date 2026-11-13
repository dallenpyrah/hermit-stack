import type { ESTree } from "@oxlint/plugins";
import { Array as Arr, Option, Predicate, pipe } from "effect";

const isEffectMember =
  (names: readonly string[]) =>
  (callee: ESTree.Expression): boolean =>
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "Effect" &&
    callee.property.type === "Identifier" &&
    names.includes(callee.property.name);

const literalString = (argument: ESTree.Node): Option.Option<string> => {
  if (argument.type !== "Literal" || !Predicate.isString(argument.value)) {
    return Option.none();
  }

  return Option.some(argument.value);
};

const stringArgument = (call: ESTree.CallExpression): Option.Option<string> =>
  pipe(Arr.head(call.arguments), Option.flatMap(literalString));

const bindingName =
  (value: ESTree.Node) =>
  (holder: ESTree.Node): Option.Option<string> => {
    if (holder.type === "VariableDeclarator" && holder.init === value && holder.id.type === "Identifier") {
      return Option.some(holder.id.name);
    }

    const isKeyed = holder.type === "Property" || holder.type === "PropertyDefinition";

    if (isKeyed && holder.value === value && !holder.computed && holder.key.type === "Identifier") {
      return Option.some(holder.key.name);
    }

    return Option.none();
  };

const classFactory = (superClass: ESTree.Expression | null): Option.Option<ESTree.MemberExpression> => {
  if (superClass?.type !== "CallExpression" || superClass.callee.type !== "CallExpression") {
    return Option.none();
  }

  const factory = superClass.callee.callee;

  if (factory.type !== "MemberExpression" || factory.computed) {
    return Option.none();
  }

  return Option.some(factory);
};

const errorFactories = new Set(["ErrorClass", "TaggedError", "TaggedErrorClass"]);

const isErrorFactory = (superClass: ESTree.Expression | null): boolean =>
  pipe(
    classFactory(superClass),
    Option.exists((factory) => factory.property.type === "Identifier" && errorFactories.has(factory.property.name)),
  );

const isServiceFactory = (superClass: ESTree.Expression | null): boolean =>
  pipe(
    classFactory(superClass),
    Option.exists(
      (factory) =>
        factory.object.type === "Identifier" &&
        factory.object.name === "Context" &&
        factory.property.type === "Identifier" &&
        factory.property.name === "Service",
    ),
  );

export { bindingName, isEffectMember, isErrorFactory, isServiceFactory, literalString, stringArgument };
