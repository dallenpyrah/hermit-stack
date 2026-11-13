import { Array as Arr, Option, Record as Rec, Schema, String as Str, pipe } from "effect";

const roleNames = [
  "actor",
  "adapter",
  "aggregate",
  "api",
  "bench",
  "build",
  "cli",
  "command",
  "config",
  "context",
  "contract",
  "durable-object",
  "errors",
  "event",
  "external",
  "fake",
  "gen",
  "handlers",
  "id",
  "job",
  "layer",
  "machine",
  "main",
  "message",
  "middleware",
  "migrations",
  "model",
  "page",
  "plugin",
  "policy",
  "projection",
  "pure",
  "query",
  "rejection",
  "resource",
  "rule",
  "saga",
  "schema",
  "service",
  "sql",
  "stack",
  "stream",
  "stylex",
  "subscription",
  "suite",
  "table",
  "test",
  "update",
  "view",
  "worker",
  "workload",
] as const;

const Role = Schema.Literals(roleNames);

type Role = typeof Role.Type;

const domainRoles: readonly Role[] = [
  "aggregate",
  "context",
  "event",
  "external",
  "id",
  "middleware",
  "policy",
  "projection",
  "query",
  "rejection",
  "saga",
  "stream",
];

const optInRoles: readonly Role[] = ["build", "command", "message", "model", "subscription", "update", ...domainRoles];

const rolePackages: Readonly<Partial<Record<Role, readonly string[]>>> = {
  actor: ["@typeonce/effect-machine"],
  machine: ["@typeonce/effect-machine"],
  test: ["@typeonce/effect-machine/testing"],
};

interface RoleFileName {
  readonly extension: string;
  readonly name: string;
  readonly role: Role;
  readonly tested: Option.Option<Role>;
}

const roleFileName =
  /^(?<name>[a-z0-9]+(?:-[a-z0-9]+)*)\.(?:(?<tested>[a-z]+(?:-[a-z]+)*)\.(?:(?<aspect>[a-z]+)\.)?)?(?<role>[a-z]+(?:-[a-z]+)*)\.(?<extension>[cm]?[jt]sx?)$/u;

const roleSpecifier = /^[^.]+\.(?<role>[a-z]+(?:-[a-z]+)*)$/u;

const sourceExtension = /\.[cm]?[jt]sx?$/u;

const isRole = Schema.is(Role);

const pathSegments = (filePath: string): Arr.NonEmptyReadonlyArray<string> => pipe(filePath, Str.split(/[\\/]/u));

const baseName = (filePath: string): string => Arr.lastNonEmpty(pathSegments(filePath));

const parentName = (filePath: string): Option.Option<string> =>
  pipe(pathSegments(filePath), Arr.initNonEmpty, Arr.last);

const testAspects: readonly string[] = ["portable", "browser", "workerd", "bundle", "types", "live", "composed"];

const groupOf = (groups: Readonly<Record<string, string>>, key: string): Option.Option<string> =>
  pipe(Rec.get(groups, key), Option.flatMap(Option.fromNullishOr));

const testedRole = (groups: Readonly<Record<string, string>>, role: Role): Option.Option<Option.Option<Role>> => {
  const tested = groupOf(groups, "tested");
  const aspect = groupOf(groups, "aspect");

  if (Option.isNone(tested)) {
    return Option.some(Option.none());
  }

  if (role !== "test" || !isRole(tested.value) || tested.value === "test") {
    return Option.none();
  }

  if (Option.isSome(aspect) && !Arr.contains(testAspects, aspect.value)) {
    return Option.none();
  }

  return Option.some(Option.some(tested.value));
};

const fileNameOf = (groups: Readonly<Record<string, string>>): Option.Option<RoleFileName> => {
  const role = pipe(Rec.get(groups, "role"), Option.filter(isRole));
  const parsed = Option.all({ extension: Rec.get(groups, "extension"), name: Rec.get(groups, "name"), role });

  return Option.flatMap(parsed, (fields) => {
    const tested = testedRole(groups, fields.role);

    return Option.map(tested, (value) => ({ ...fields, tested: value }));
  });
};

const parseFileName = (fileName: string): Option.Option<RoleFileName> =>
  pipe(Option.fromNullishOr(roleFileName.exec(fileName)?.groups), Option.flatMap(fileNameOf));

const roleOfSpecifier = (specifier: string): Option.Option<Role> => {
  const stem = pipe(baseName(specifier), Str.replace(sourceExtension, ""));

  return pipe(
    Option.fromNullishOr(roleSpecifier.exec(stem)?.groups),
    Option.flatMap((groups) => Rec.get(groups, "role")),
    Option.filter(isRole),
  );
};

export {
  baseName,
  domainRoles,
  optInRoles,
  parentName,
  parseFileName,
  pathSegments,
  Role,
  roleNames,
  roleOfSpecifier,
  rolePackages,
  testAspects,
};
