import type { Schema } from "effect";

const FlagTypeId = "~@repo/flags/Flag";

type FlagName = `${string}.${string}`;

type IsoDate = `${number}-${number}-${number}`;

interface FlagFields<Value> {
  readonly [FlagTypeId]: typeof FlagTypeId;
  readonly default: Value;
  readonly name: FlagName;
  readonly owner: string;
  readonly purpose: string;
  readonly schema: Schema.Codec<Value, unknown>;
}

interface ReleaseFlag<Value> extends FlagFields<Value> {
  readonly kind: "release";
  readonly removeBy: IsoDate;
}

interface OpsFlag<Value> extends FlagFields<Value> {
  readonly kind: "ops";
  readonly reviewBy: IsoDate;
}

type Flag<Value> = ReleaseFlag<Value> | OpsFlag<Value>;

interface FlagOptions<Value> {
  readonly default: Value;
  readonly owner: string;
  readonly purpose: string;
}

interface ReleaseOptions<Value> extends FlagOptions<Value> {
  readonly removeBy: IsoDate;
}

interface OpsOptions<Value> extends FlagOptions<Value> {
  readonly reviewBy: IsoDate;
}

const release = <Value>(
  name: FlagName,
  schema: Schema.Codec<Value, unknown>,
  options: ReleaseOptions<NoInfer<Value>>,
): ReleaseFlag<Value> => ({
  ...options,
  [FlagTypeId]: FlagTypeId,
  kind: "release",
  name,
  schema,
});

const ops = <Value>(
  name: FlagName,
  schema: Schema.Codec<Value, unknown>,
  options: OpsOptions<NoInfer<Value>>,
): OpsFlag<Value> => ({
  ...options,
  [FlagTypeId]: FlagTypeId,
  kind: "ops",
  name,
  schema,
});

const Flag = { ops, release };

export { Flag, FlagTypeId };

export type { FlagName, IsoDate, OpsFlag, ReleaseFlag };
