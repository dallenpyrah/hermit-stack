import { defineRule } from "@oxlint/plugins";
import type { ESTree, Visitor } from "@oxlint/plugins";
import { Array as Arr, Option, Predicate, Schema, String as Str, pipe } from "effect";

import { Role, baseName, parseFileName, pathSegments, roleNames, roleOfSpecifier, rolePackages } from "./roles.pure.js";

type RoleEdges = Readonly<Partial<Record<Role, readonly Role[]>>>;

interface Importers {
  readonly problem: string;
  readonly roles: readonly Role[];
}

const definitions: readonly Role[] = ["api", "contract", "errors", "schema"];

const allowedTargets: RoleEdges = {
  actor: [...definitions, "machine", "migrations", "pure", "service", "sql"],
  aggregate: ["command", "event", "id", "pure", "rejection", "schema"],
  api: definitions,
  command: [...definitions, "adapter", "command", "message", "model", "pure", "service"],
  context: [...definitions, "context", "id", "rejection"],
  contract: definitions,
  errors: definitions,
  event: [...definitions, "id", "pure"],
  external: ["errors", "id", "rejection", "schema"],
  handlers: [...definitions, "pure", "service"],
  id: [...definitions, "id", "pure"],
  job: [...definitions, "adapter", "machine", "pure", "service"],
  machine: [...definitions, "machine", "pure"],
  message: [...definitions, "message", "model", "pure"],
  middleware: [...definitions, "context", "id", "rejection"],
  migrations: [...definitions, "pure", "sql", "table"],
  model: [...definitions, "model", "pure"],
  policy: ["aggregate", "command", "event", "external", "id", "pure", "saga", "schema"],
  projection: ["aggregate", "command", "event", "id", "pure", "schema", "service"],
  pure: [...definitions, "pure"],
  query: ["id", "projection", "schema", "service"],
  rejection: [...definitions, "id", "pure"],
  saga: ["aggregate", "command", "event", "external", "id", "pure", "schema"],
  schema: definitions,
  service: [...definitions, "adapter", "machine", "pure", "service", "sql"],
  sql: [...definitions, "pure", "sql", "table"],
  stream: ["aggregate", "command", "event", "id", "pure", "schema", "service"],
  subscription: [...definitions, "adapter", "command", "message", "model", "pure", "subscription", "service"],
  update: [...definitions, "command", "message", "model", "pure", "update"],
};

const neverImported = new Set<Role>(["bench", "cli", "main", "test"]);

const targetsOf = (edges: RoleEdges, role: Role): Option.Option<readonly Role[]> =>
  Option.orElse(Option.fromNullishOr(edges[role]), () => Option.fromNullishOr(allowedTargets[role]));

const testOnly =
  "Fakes and suites exist for tests, so production code that reaches them ships test behavior. Fix: import the real service, and provide the fake only from tests.";

const allowedImporters: Readonly<Partial<Record<Role, Importers>>> = {
  build: {
    problem:
      "A .build file runs only while a framework builds the app, on Node's file system and with no Effect runtime, so code that runs with the app breaks when it reaches one, or ships build code to the browser. Fix: compute the value in a framework entry file or a .config file and pass it in, or move the shared logic to a .pure file.",
    roles: ["build", "config", "test"],
  },
  fake: { problem: testOnly, roles: ["bench", "fake", "layer", "suite", "test", "workload"] },
  suite: { problem: testOnly, roles: ["test"] },
};

const scopeChecked: readonly Role[] = ["contract", "pure"];

const RoleEdgesOption = Schema.Record(Schema.String, Schema.Array(Role));

const RoleImportsOptions = Schema.Struct({
  definitionServices: Schema.optional(Schema.Array(Schema.String)),
  edges: Schema.optional(RoleEdgesOption),
  exports: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  packages: Schema.Array(Schema.String),
});

const matchesPackage = (allowedPackages: readonly string[], specifier: string): boolean =>
  Arr.some(allowedPackages, (allowed) => {
    if (Str.endsWith("/")(allowed)) {
      return Str.startsWith(allowed)(specifier);
    }

    return specifier === allowed || Str.startsWith(`${allowed}/`)(specifier);
  });

const allowsPackage = (packages: readonly string[], specifier: string): boolean =>
  matchesPackage(["effect", ...packages], specifier);

const listedPackages = (role: Role): readonly string[] => rolePackages[role] ?? [];

const restrictedPackages: readonly string[] = Arr.flatMap(roleNames, listedPackages);

const restrictedListing: string = pipe(
  roleNames,
  Arr.filter((owner) => Arr.isReadonlyArrayNonEmpty(listedPackages(owner))),
  Arr.map((owner) => `.${owner}: ${Arr.join(listedPackages(owner), ", ")}`),
  Arr.join("; "),
);

const isListedFor = (role: Role, specifier: string): boolean => Arr.contains(listedPackages(role), specifier);

const testsImport = (specifier: string): string =>
  `A file in src/ imports "${specifier}". Fakes and workloads in tests/ exist only for tests, so src/ that reaches them ships test code. Fix: import the real source, and provide the fake only from a test.`;

const benchImport = (specifier: string): string =>
  `A file in src/ imports "${specifier}". A package's bench/ holds benches and the workloads they run, outside src/ and the tests/ mirror, so src/ that reaches them ships bench code. Fix: move what both need into src/, and import it from the bench.`;

const reachesBench = (filename: string, specifier: string): boolean => {
  const folders = Arr.initNonEmpty(pathSegments(filename));
  const parts = Arr.filter(Str.split(specifier, "/"), (part) => part !== ".");
  const ups = Arr.takeWhile(parts, (part) => part === "..").length;

  return pipe(
    Arr.findLastIndex(folders, (folder) => folder === "src"),
    Option.exists((src) => ups === folders.length - src && Arr.get(parts, ups).pipe(Option.contains("bench"))),
  );
};

const computedImport = (edges: RoleEdges, role: Role): Option.Option<string> => {
  if (Option.isNone(targetsOf(edges, role))) {
    return Option.none();
  }

  return Option.some(
    `A .${role} file calls import() with a computed specifier, so this rule cannot tell whether it reaches I/O or a role a .${role} file must not depend on. Fix: import a literal specifier, or move the dynamic import to a .adapter file.`,
  );
};

const literalSpecifier = (source: ESTree.Expression): Option.Option<string> => {
  if (source.type === "Literal" && Predicate.isString(source.value)) {
    return Option.some(source.value);
  }

  if (source.type === "TemplateLiteral" && Arr.isReadonlyArrayEmpty(source.expressions)) {
    return pipe(
      Arr.head(source.quasis),
      Option.flatMap((quasi) => Option.fromNullishOr(quasi.value.cooked)),
    );
  }

  return Option.none();
};

const isLocal = (specifier: string): boolean => Str.startsWith(".")(specifier) || Str.startsWith("#")(specifier);

interface ImportSite {
  readonly definitionServices: readonly string[];
  readonly edges: RoleEdges;
  readonly exports: Readonly<Record<string, string>>;
  readonly filename: string;
  readonly packages: readonly string[];
  readonly role: Role;
  readonly specifier: string;
}

const localProblem = (edges: RoleEdges, role: Role, target: Role): Option.Option<string> => {
  if (neverImported.has(target)) {
    return Option.some(
      `A .${role} file imports a .${target} file. Entry points and tests are run, never imported, so the import drags a program into a module. Fix: move what both need into a role file they both import.`,
    );
  }

  const importers = Option.fromNullishOr(allowedImporters[target]);

  if (Option.isSome(importers) && !importers.value.roles.includes(role)) {
    return Option.some(`A .${role} file imports a .${target} file. ${importers.value.problem}`);
  }

  const targets = targetsOf(edges, role);

  if (Option.isSome(targets) && !targets.value.includes(target)) {
    return Option.some(
      `A .${role} file imports a .${target} file. A .${role} file may only import ${pipe(
        targets.value,
        Arr.map((allowed) => `.${allowed}`),
        Arr.join(", "),
      )} files, so this edge mixes layers that must stay apart. Fix: move the dependency the other way, or move this code to a role that may depend on it.`,
    );
  }

  return Option.none();
};

const scopeProblem = ({
  definitionServices,
  edges,
  exports,
  packages,
  role,
  specifier,
}: Omit<ImportSite, "filename">): Option.Option<string> => {
  if (!Arr.contains(scopeChecked, role) || !matchesPackage(Arr.filter(packages, Str.endsWith("/")), specifier)) {
    return Option.none();
  }

  const file = Option.fromNullishOr(exports[specifier]);
  const target = Option.flatMap(file, (path) => parseFileName(baseName(path)));

  if (Option.isNone(file) || Option.isNone(target)) {
    return Option.some(
      `A .${role} file imports "${specifier}", which this rule's packages option allows only through a whole scope, and the exports map built from the workspace's package.json files names no role file for it. A scope can hold adapters, layers and I/O, so a .${role} file may only reach a scoped module whose role it may import. Fix: export the module from a role-named file in its package's exports, or import it from a role that may depend on it.`,
    );
  }

  if (
    Arr.contains(definitions, role) &&
    target.value.role === "service" &&
    Arr.contains(definitionServices, specifier)
  ) {
    return Option.none();
  }

  return Option.map(
    localProblem(edges, role, target.value.role),
    (problem) => `"${specifier}" resolves to ${file.value}. ${problem}`,
  );
};

const packageProblem = ({
  definitionServices,
  edges,
  exports,
  packages,
  role,
  specifier,
}: ImportSite): Option.Option<string> => {
  if (isListedFor(role, specifier)) {
    return Option.none();
  }

  if (matchesPackage(restrictedPackages, specifier)) {
    return Option.some(
      `A .${role} file imports the package "${specifier}". A lifecycle package may only be imported where a role lists it (${restrictedListing}), so lifecycles are planned only inside commands and never started, timed or tested in production code. Fix: import an entry your role lists, or move this code to a role that lists it.`,
    );
  }

  if (Option.isNone(targetsOf(edges, role))) {
    return Option.none();
  }

  if (!allowsPackage(packages, specifier)) {
    return Option.some(
      `A .${role} file imports the package "${specifier}". Definitions and logic must stay free of I/O and platform code so they run and test anywhere. Fix: reach the package through a .adapter file, or add it to this rule's packages option if it is pure logic.`,
    );
  }

  return scopeProblem({ definitionServices, edges, exports, packages, role, specifier });
};

const specifierProblem = (site: ImportSite): Option.Option<string> => {
  const { filename, role, specifier } = site;

  if (Arr.contains(pathSegments(filename), "src") && Str.startsWith("#tests/")(specifier)) {
    return Option.some(testsImport(specifier));
  }

  if (reachesBench(filename, specifier)) {
    return Option.some(benchImport(specifier));
  }

  if (!isLocal(specifier)) {
    return packageProblem(site);
  }

  return pipe(
    roleOfSpecifier(specifier),
    Option.flatMap((target) => localProblem(site.edges, role, target)),
  );
};

const optionsOf = (
  options: readonly unknown[],
): Pick<ImportSite, "definitionServices" | "edges" | "exports" | "packages"> => {
  const {
    definitionServices = [],
    edges = {},
    exports = {},
    packages,
  } = pipe(
    Arr.head(options),
    Option.flatMap(Schema.decodeUnknownOption(RoleImportsOptions)),
    Option.getOrElse((): (typeof RoleImportsOptions)["Type"] => ({ packages: [] })),
  );

  return { definitionServices, edges, exports, packages };
};

const roleImports = defineRule({
  create(context): Visitor {
    const role = parseFileName(baseName(context.filename));

    if (Option.isNone(role)) {
      return {};
    }

    const options = optionsOf(context.options);

    const problemOf = (specifier: string): Option.Option<string> =>
      specifierProblem({ ...options, filename: context.filename, role: role.value.role, specifier });

    const report = (node: ESTree.Node, problem: Option.Option<string>): void => {
      if (Option.isSome(problem)) {
        context.report({ message: problem.value, node });
      }
    };

    return {
      ExportAllDeclaration(node): void {
        if (node.exportKind !== "type") {
          report(node, problemOf(node.source.value));
        }
      },
      ExportNamedDeclaration(node): void {
        if (node.source !== null && node.exportKind !== "type") {
          report(node, problemOf(node.source.value));
        }
      },
      ImportDeclaration(node): void {
        if (node.importKind !== "type") {
          report(node, problemOf(node.source.value));
        }
      },
      ImportExpression(node): void {
        report(
          node,
          Option.match(literalSpecifier(node.source), {
            onNone: () => computedImport(options.edges, role.value.role),
            onSome: problemOf,
          }),
        );
      },
    };
  },
  meta: {
    messages: {},
    schema: [
      {
        additionalProperties: false,
        anyOf: [{ required: ["exports"] }, { properties: { packages: { items: { not: { pattern: "/$" } } } } }],
        properties: {
          definitionServices: { items: { type: "string" }, type: "array" },
          edges: {
            additionalProperties: { items: { enum: [...roleNames] }, type: "array" },
            propertyNames: { enum: [...roleNames] },
            type: "object",
          },
          exports: { additionalProperties: { type: "string" }, type: "object" },
          packages: { items: { type: "string" }, type: "array" },
        },
        type: "object",
      },
    ],
    type: "problem",
  },
});

export { roleImports };
