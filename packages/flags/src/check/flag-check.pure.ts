import { Array as Arr, DateTime, Function as Fn, Match, Option, Predicate, Result, Schema, pipe } from "effect";

// Node runs flags:check without a build step, and Node resolves only real file names, so this import names the .ts file.
import { FlagTypeId } from "#src/flag/flag.pure.ts";

interface Declared {
  readonly exportName: string;
  readonly file: string;
  readonly value: unknown;
}

const problemsArity = 2;

const segment = "[a-z][a-z0-9]*(?:-[a-z0-9]+)*";

const IsoDate = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u),
  Schema.makeFilter(
    (value: string) =>
      Option.exists(DateTime.make(`${value}T00:00:00Z`), (date) => DateTime.formatIsoDateUtc(date) === value),
    { expected: "a real date written YYYY-MM-DD" },
  ),
);

const fields = {
  name: Schema.String.check(Schema.isPattern(new RegExp(`^${segment}\\.${segment}$`, "u"))),
  owner: Schema.NonEmptyString,
  purpose: Schema.NonEmptyString,
};

// What flags:check needs from a flag. It decodes every exported flag, so a date a flag file computed wrongly is a
// Failure rather than a flag that never expires.
const FlagMetadata = Schema.Union([
  Schema.Struct({ ...fields, kind: Schema.Literal("release"), removeBy: IsoDate }),
  Schema.Struct({ ...fields, kind: Schema.Literal("ops"), reviewBy: IsoDate }),
]);

const datedProblem = (metadata: typeof FlagMetadata.Type, file: string, today: string): Option.Option<string> => {
  const [action, date] = pipe(
    Match.value(metadata),
    Match.discriminatorsExhaustive("kind")({
      ops: ({ reviewBy }) => ["review", reviewBy] as const,
      release: ({ removeBy }) => ["removal", removeBy] as const,
    }),
  );

  return pipe(
    Option.some(`${metadata.name} (${file}, owner ${metadata.owner}) was due for ${action} on ${date}.`),
    Option.filter(() => date < today),
  );
};

const declaredProblem = (declared: Declared, today: string): Option.Option<string> =>
  Result.match(Schema.decodeUnknownResult(FlagMetadata)(declared.value), {
    onFailure: (error) =>
      Option.some(`${declared.exportName} (${declared.file}) is not a valid flag: ${error.message}`),
    onSuccess: (metadata) => datedProblem(metadata, declared.file, today),
  });

// One line per flag past its date or with a definition flags:check cannot read. Exports that are not flags are skipped,
// So a .flag.ts file may also export the schema its flag uses.
const flagProblems: {
  (today: string): (declared: readonly Declared[]) => readonly string[];
  (declared: readonly Declared[], today: string): readonly string[];
} = Fn.dual(problemsArity, (declared: readonly Declared[], today: string): readonly string[] =>
  pipe(
    declared,
    Arr.filter((entry) => Predicate.hasProperty(entry.value, FlagTypeId)),
    Arr.map((entry) => declaredProblem(entry, today)),
    Arr.getSomes,
  ),
);

export { flagProblems };

export type { Declared };
