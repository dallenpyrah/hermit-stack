import { defineRule } from "@oxlint/plugins";
import type { ESTree, Visitor } from "@oxlint/plugins";
import { Array as Arr, Option, Schema, pipe } from "effect";

import { isErrorFactory, isServiceFactory } from "#oxlint/effect-call-syntax.pure";

import { baseName, domainRoles, parseFileName } from "./roles.pure.js";
import type { Role } from "./roles.pure.js";

interface ExportedValue {
  readonly isError: boolean;
  readonly isService: boolean;
  readonly name: string;
  readonly node: ESTree.Node;
}

interface ExportFacts {
  readonly adapterExports: AdapterExports;
  readonly classes: readonly ExportedValue[];
  readonly fileName: string;
  readonly program: ESTree.Program;
  readonly role: Role;
  readonly values: readonly ExportedValue[];
}

interface Finding {
  readonly message: string;
  readonly node: ESTree.Node;
}

const AdapterExportsOption = Schema.Struct({ adapterExports: Schema.Literals(["service", "functions"]) });

type AdapterExports = typeof AdapterExportsOption.Type.adapterExports;

type TopLevelStatement = ESTree.Program["body"][number];

const silentRoles = new Set<Role>(["bench", "cli", "main", "test"]);

const serviceRoles = new Set<Role>(["adapter", "service"]);

const serviceFreeRoles = new Set<Role>([
  "api",
  "build",
  "command",
  "contract",
  "errors",
  "layer",
  "machine",
  "message",
  "model",
  "pure",
  "schema",
  "subscription",
  "update",
  ...domainRoles,
]);

const typeScriptFile = /\.[cm]?tsx?$/u;

const servicesPerFile = 1;

const exportsPerRule = 1;

const classValue = (node: ESTree.Class): Option.Option<ExportedValue> =>
  pipe(
    Option.fromNullishOr(node.id),
    Option.map((id) => ({
      isError: isErrorFactory(node.superClass),
      isService: isServiceFactory(node.superClass),
      name: id.name,
      node,
    })),
  );

const plainValue = (name: string, node: ESTree.Node): ExportedValue => ({
  isError: false,
  isService: false,
  name,
  node,
});

const bindingLabel = (declarator: ESTree.VariableDeclarator): string => {
  if (declarator.id.type === "Identifier") {
    return declarator.id.name;
  }

  return "a destructured binding";
};

const declaredValues = (declaration: ESTree.Declaration): readonly ExportedValue[] => {
  if (declaration.type === "ClassDeclaration") {
    return Option.toArray(classValue(declaration));
  }

  if (declaration.type === "FunctionDeclaration" || declaration.type === "TSEnumDeclaration") {
    return [plainValue(declaration.id?.name ?? "default", declaration)];
  }

  if (declaration.type === "VariableDeclaration") {
    return Arr.map(declaration.declarations, (declarator) => plainValue(bindingLabel(declarator), declarator));
  }

  return [];
};

const declarationOf = (statement: TopLevelStatement): Option.Option<ESTree.Node> => {
  if (statement.type === "ExportNamedDeclaration") {
    return Option.fromNullishOr(statement.declaration);
  }

  return Option.some(statement);
};

const topLevelClasses = (program: ESTree.Program): readonly ExportedValue[] =>
  Arr.flatMap(program.body, (statement) =>
    pipe(
      declarationOf(statement),
      Option.flatMap((declaration) => {
        if (declaration.type !== "ClassDeclaration") {
          return Option.none();
        }

        return classValue(declaration);
      }),
      Option.toArray,
    ),
  );

const localName = (specifier: ESTree.ExportSpecifier): string => {
  if (specifier.local.type === "Identifier") {
    return specifier.local.name;
  }

  return specifier.local.value;
};

const specifierValues = (
  statement: ESTree.ExportNamedDeclaration,
  classes: readonly ExportedValue[],
): readonly ExportedValue[] =>
  Arr.flatMap(statement.specifiers, (specifier) => {
    if (specifier.exportKind === "type") {
      return [];
    }

    const local = localName(specifier);

    return [
      pipe(
        Arr.findFirst(classes, (value) => value.name === local),
        Option.getOrElse(() => plainValue(local, specifier)),
      ),
    ];
  });

const statementValues = (statement: TopLevelStatement, classes: readonly ExportedValue[]): readonly ExportedValue[] => {
  if (statement.type === "ExportDefaultDeclaration") {
    return [plainValue("default", statement)];
  }

  if (statement.type === "ExportAllDeclaration" && statement.exportKind !== "type") {
    return [plainValue("*", statement)];
  }

  if (statement.type !== "ExportNamedDeclaration" || statement.exportKind === "type") {
    return [];
  }

  if (statement.declaration !== null) {
    return declaredValues(statement.declaration);
  }

  return specifierValues(statement, classes);
};

const silentExports = ({ role, values }: ExportFacts): readonly Finding[] => {
  if (!silentRoles.has(role)) {
    return [];
  }

  return Arr.map(values, (value) => ({
    message: `A .${role} file exports "${value.name}". Entry points, benchmarks and tests are run, never imported, so the export is dead code or a hidden dependency. Fix: move it to a role file that both sides import.`,
    node: value.node,
  }));
};

const serviceCount = (role: Role, count: number, program: ESTree.Program): readonly Finding[] => {
  if (count === servicesPerFile) {
    return [];
  }

  return [
    {
      message: `A .${role} file must export exactly one Context.Service class, and this one exports ${count}. Dependents then cannot tell which service the file owns. Fix: keep one service here and move each other one to its own .${role} file.`,
      node: program,
    },
  ];
};

const serviceExports = ({ adapterExports, fileName, program, role, values }: ExportFacts): readonly Finding[] => {
  if (!serviceRoles.has(role) || !typeScriptFile.test(fileName)) {
    return [];
  }

  if (role === "adapter" && adapterExports === "functions") {
    return [];
  }

  const services = Arr.filter(values, (value) => value.isService);
  const others = Arr.filter(values, (value) => !value.isService);

  return [
    ...serviceCount(role, services.length, program),
    ...Arr.map(others, (value) => ({
      message: `A .${role} file also exports "${value.name}". The file then owns two things, so every dependent pulls in both. Fix: move "${value.name}" to its own role file, such as .pure, .schema or .errors.`,
      node: value.node,
    })),
  ];
};

const errorExports = ({ role, values }: ExportFacts): readonly Finding[] => {
  if (role !== "errors") {
    return [];
  }

  return pipe(
    values,
    Arr.filter((value) => !value.isError),
    Arr.map((value) => ({
      message: `A .errors file exports "${value.name}", which is not a tagged error class. Callers then import behavior from a file that should only name failures. Fix: move it to its own role file.`,
      node: value.node,
    })),
  );
};

const hiddenServices = ({ classes, role }: ExportFacts): readonly Finding[] => {
  if (!serviceFreeRoles.has(role)) {
    return [];
  }

  return pipe(
    classes,
    Arr.filter((value) => value.isService),
    Arr.map((service) => ({
      message: `A .${role} file defines the service "${service.name}". Services decide and own a layer, so hiding one in a .${role} file breaks the role's promise. Fix: move it to its own .service file.`,
      node: service.node,
    })),
  );
};

const ruleExports = ({ program, role, values }: ExportFacts): readonly Finding[] => {
  if (role !== "rule" || values.length === exportsPerRule) {
    return [];
  }

  return [
    {
      message: `A .rule file must export exactly one rule, and this one exports ${values.length} values. A plugin then cannot tell which export is the rule. Fix: keep one rule here and move each other export to its own file.`,
      node: program,
    },
  ];
};

const indexCode = (program: ESTree.Program): readonly Finding[] =>
  pipe(
    program.body,
    Arr.filter(
      (statement) =>
        statement.type !== "ExportAllDeclaration" &&
        (statement.type !== "ExportNamedDeclaration" || statement.source === null),
    ),
    Arr.map((statement) => ({
      message:
        "Index file holds code of its own. An index file is a package entry, so code here has no role and no owner. Fix: move the code to a role file and re-export it here.",
      node: statement,
    })),
  );

const roleChecks = [silentExports, serviceExports, errorExports, hiddenServices, ruleExports];

const findings = (fileName: string, program: ESTree.Program, adapterExports: AdapterExports): readonly Finding[] => {
  if (fileName === "index.ts" || fileName === "index.tsx") {
    return indexCode(program);
  }

  return pipe(
    parseFileName(fileName),
    Option.map(({ role }) => {
      const classes = topLevelClasses(program);
      const values = Arr.flatMap(program.body, (statement) => statementValues(statement, classes));
      const facts = { adapterExports, classes, fileName, program, role, values };

      return Arr.flatMap(roleChecks, (check) => check(facts));
    }),
    Option.getOrElse(() => []),
  );
};

const roleExports = defineRule({
  create(context): Visitor {
    const { adapterExports } = pipe(
      Arr.head(context.options),
      Option.flatMap(Schema.decodeUnknownOption(AdapterExportsOption)),
      Option.getOrElse((): typeof AdapterExportsOption.Type => ({ adapterExports: "service" })),
    );

    return {
      Program(program): void {
        for (const finding of findings(baseName(context.filename), program, adapterExports)) {
          context.report({ message: finding.message, node: finding.node });
        }
      },
    };
  },
  meta: {
    messages: {},
    schema: [
      {
        additionalProperties: false,
        properties: { adapterExports: { enum: ["service", "functions"] } },
        type: "object",
      },
    ],
    type: "problem",
  },
});

export { roleExports };
