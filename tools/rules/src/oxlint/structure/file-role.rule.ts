import { defineRule } from "@oxlint/plugins";
import type { Visitor } from "@oxlint/plugins";
import { Array as Arr, Option, Schema, pipe } from "effect";

import {
  baseName,
  optInRoles,
  parentName,
  parseFileName,
  pathSegments,
  Role,
  roleNames,
  testAspects,
} from "./roles.pure.js";

const entryNames = new Set(["index.ts", "index.tsx"]);

const FileRoleOptions = Schema.Struct({
  roles: Schema.optionalKey(Schema.Array(Role)),
  skip: Schema.optionalKey(Schema.Array(Schema.String)),
});

const isOff = (roles: readonly Role[], role: Role): boolean =>
  Arr.contains(optInRoles, role) && !Arr.contains(roles, role);

const roleList = (roles: readonly Role[]): string =>
  pipe(
    roleNames,
    Arr.filter((role) => !isOff(roles, role)),
    Arr.map((role) => `.${role}`),
    Arr.join(", "),
  );

const indexProblem = (filename: string, fileName: string): Option.Option<string> => {
  if (
    pipe(
      parentName(filename),
      Option.exists((parent) => parent === "src"),
    )
  ) {
    return Option.none();
  }

  return Option.some(
    `Index file "${fileName}" sits outside a package's src folder. Index files elsewhere turn folders into barrels that hide which file owns what. Fix: rename it to <kebab-name>.<role>.ts, or point package.json exports straight at the role file.`,
  );
};

const nameProblem = (filename: string, fileName: string, roles: readonly Role[]): Option.Option<string> => {
  if (entryNames.has(fileName)) {
    return indexProblem(filename, fileName);
  }

  const parsed = parseFileName(fileName);

  if (Option.isNone(parsed)) {
    return Option.some(
      `File name "${fileName}" does not name its role. Readers and imports then cannot tell what the file is for. Fix: rename it to <kebab-name>.<role>.<ext>, where role is one of ${roleList(roles)}, or name a test <kebab-name>.<role>.test.<ext> or <kebab-name>.<role>.<aspect>.test.<ext> after the src/ file it tests, where aspect is one of ${Arr.join(testAspects, ", ")}.`,
    );
  }

  if (
    parsed.value.role === "test" &&
    Option.isNone(parsed.value.tested) &&
    Arr.contains(pathSegments(filename), "tests")
  ) {
    return Option.some(
      `Test "${fileName}" in tests/ does not name the role of the src/ file it tests. A test mirrors one src/ file at its path and name, so a reader finds that file from the test's name. Fix: rename it to <name>.<role>.test.${parsed.value.extension} after the src/ file it tests, such as command-replay.service.test.ts for src/command-replay.service.ts.`,
    );
  }

  if (isOff(roles, parsed.value.role)) {
    return Option.some(
      `File "${fileName}" takes the opt-in .${parsed.value.role} role, which this config does not enable. An opt-in role names a specific kind of module, so it must be enabled only where that kind belongs. Fix: list "${parsed.value.role}" in this rule's roles option for these files, or rename it to the role of what it holds, one of ${roleList(roles)}.`,
    );
  }

  return Option.none();
};

const fileRole = defineRule({
  create(context): Visitor {
    const { roles = [], skip = [] } = pipe(
      Arr.head(context.options),
      Option.flatMap(Schema.decodeUnknownOption(FileRoleOptions)),
      Option.getOrElse((): typeof FileRoleOptions.Type => ({})),
    );

    return {
      Program(node): void {
        const fileName = baseName(context.filename);

        if (Arr.contains(skip, fileName)) {
          return;
        }

        const problem = nameProblem(context.filename, fileName, roles);

        if (Option.isSome(problem)) {
          context.report({ message: problem.value, node });
        }
      },
    };
  },
  meta: {
    messages: {},
    schema: [
      {
        additionalProperties: false,
        properties: {
          roles: { items: { enum: [...optInRoles] }, type: "array" },
          skip: { items: { type: "string" }, type: "array" },
        },
        type: "object",
      },
    ],
    type: "problem",
  },
});

export { fileRole };
