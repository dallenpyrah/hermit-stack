import { defineRule } from "@oxlint/plugins";
import type { ESTree, Visitor } from "@oxlint/plugins";
import { Array as Arr, Option, Predicate, pipe } from "effect";

const portKey = /(?:^|_)port$/iu;

const testFile = /(?:^|\/)tests\/|\.test\.[cm]?[jt]sx?$/u;

const digits = /^\d+$/u;

const anyPort = 0;

const conversions = new Set(["Number", "String"]);

type Constants = ReadonlyMap<string, number>;

type PropertyNode = NonNullable<Visitor["Property"]> extends (node: infer Node) => void ? Node : never;

const declaratorsOf = (node: ESTree.Node | null): readonly ESTree.VariableDeclarator[] => {
  if (node?.type !== "VariableDeclaration") {
    return [];
  }

  return node.declarations;
};

const numericConstant = (declarator: ESTree.VariableDeclarator): (readonly [string, number])[] => {
  if (declarator.id.type !== "Identifier" || declarator.init?.type !== "Literal") {
    return [];
  }

  const { value } = declarator.init;

  if (!Predicate.isNumber(value)) {
    return [];
  }

  return [[declarator.id.name, value]];
};

const declaredNumbers = (program: ESTree.Program): Constants =>
  new Map(
    pipe(
      program.body,
      Arr.flatMap((statement) => {
        if (statement.type === "ExportNamedDeclaration") {
          return declaratorsOf(statement.declaration);
        }

        return declaratorsOf(statement);
      }),
      Arr.flatMap(numericConstant),
    ),
  );

const portOf = (node: ESTree.Node, constants: Constants): Option.Option<number> => {
  if (node.type === "Literal" && Predicate.isNumber(node.value)) {
    return Option.some(node.value);
  }

  if (node.type === "Literal" && Predicate.isString(node.value) && digits.test(node.value)) {
    return Option.some(Number(node.value));
  }

  if (node.type === "Identifier") {
    return Option.fromNullishOr(constants.get(node.name));
  }

  if (node.type === "CallExpression" && node.callee.type === "Identifier" && conversions.has(node.callee.name)) {
    return Option.flatMap(Arr.head(node.arguments), (argument) => portOf(argument, constants));
  }

  return Option.none();
};

const keyName = (node: PropertyNode): Option.Option<string> => {
  if (node.computed) {
    return Option.none();
  }

  if (node.key.type === "Identifier") {
    return Option.some(node.key.name);
  }

  if (node.key.type === "Literal" && Predicate.isString(node.key.value)) {
    return Option.some(node.key.value);
  }

  return Option.none();
};

const isListen = (node: ESTree.CallExpression): boolean =>
  (node.callee.type === "Identifier" && node.callee.name === "listen") ||
  (node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "listen");

const message = (port: number): string =>
  `A test binds the fixed port ${String(port)}. Two test runs on one machine, such as parallel gates, then collide on it and one fails with EADDRINUSE. Fix: listen on port 0 and call the address the server reports back.`;

const noFixedPort = defineRule({
  create(context): Visitor {
    if (!testFile.test(context.filename)) {
      return {};
    }

    let constants: Constants = new Map();

    const reportFixed = (node: ESTree.Node, port: Option.Option<number>): void => {
      Option.map(
        Option.filter(port, (value) => value !== anyPort),
        (value) => {
          context.report({ message: message(value), node });
        },
      );
    };

    return {
      CallExpression(node): void {
        if (isListen(node)) {
          reportFixed(
            node,
            Option.flatMap(Arr.head(node.arguments), (argument) => portOf(argument, constants)),
          );
        }
      },
      Program(node): void {
        constants = declaredNumbers(node);
      },
      Property(node): void {
        if (Option.exists(keyName(node), (name) => portKey.test(name))) {
          reportFixed(node, portOf(node.value, constants));
        }
      },
    };
  },
  meta: { messages: {}, type: "problem" },
});

export { noFixedPort };
