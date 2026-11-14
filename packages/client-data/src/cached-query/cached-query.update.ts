import { Array as Arr, Clock, Duration, Effect, HashMap, Option, Schema } from "effect";
import { AsyncData, Command } from "foldkit";
import { define as defineQuery } from "foldkit/experimental/query";
import type { KeyedQuery } from "foldkit/experimental/query";
import { defineMessageUnion } from "foldkit/message";
import type { MessageUnion } from "foldkit/message";
import type { Return } from "foldkit/update";

type ArgFields = Readonly<Record<string, Schema.Codec<unknown, unknown>>>;

type ArgsOf<Fields extends ArgFields> = Schema.Struct.Type<Fields>;

type ArgsCodec<Fields extends ArgFields> = Schema.Codec<ArgsOf<Fields>, Schema.Struct.Encoded<Fields>>;

type FetchedSchema<Value, Encoded> = Schema.Struct<{
  readonly fetchedAt: typeof Schema.Finite;
  readonly value: Schema.Codec<Value, Encoded>;
}>;

interface CachedQueryConfig<
  Name extends string,
  Value,
  Encoded,
  Failure,
  FailureEncoded,
  Fields extends ArgFields,
  Services,
> {
  readonly name: Name;
  readonly args: Fields;
  readonly data: Schema.Codec<Value, Encoded>;
  readonly error: Schema.Codec<Failure, FailureEncoded>;
  readonly execute: (args: ArgsOf<Fields>) => Effect.Effect<Value, Failure, Services>;
  readonly toKey: (args: ArgsOf<Fields>) => string;
  readonly staleTime: Duration.Input;
  readonly maxEntries: number;
}

type InnerQuery<
  Name extends string,
  Value,
  Encoded,
  Failure,
  FailureEncoded,
  Fields extends ArgFields,
  Services,
> = KeyedQuery<
  Name,
  FetchedSchema<Value, Encoded>["Type"],
  FetchedSchema<Value, Encoded>["Encoded"],
  Failure,
  FailureEncoded,
  Fields,
  Services
>;

type CachedModel<InnerModel extends Schema.Top> = Schema.Struct<{
  readonly query: InnerModel;
  readonly recent: Schema.$Array<typeof Schema.String>;
}>;

type CachedMessage<Fields extends ArgFields, Reply extends Schema.Top> = MessageUnion<{
  readonly CheckedFreshness: { readonly args: ArgsCodec<Fields>; readonly now: typeof Schema.Finite };
  readonly GotQueryMessage: { readonly message: Schema.Codec<Reply["Type"], Reply["Encoded"]> };
  readonly Requested: { readonly args: ArgsCodec<Fields> };
}>;

type CheckFreshnessCommand<
  Name extends string,
  Fields extends ArgFields,
  Reply extends Schema.Top,
> = Command.CommandDefinitionWithArgs<
  `CheckFreshness${Name}`,
  { readonly args: ArgsCodec<Fields> },
  Effect.Effect<CachedMessage<Fields, Reply>["CheckedFreshness"]["Type"]>
>;

interface CachedQuery<
  Name extends string,
  Value,
  Encoded,
  Failure,
  FailureEncoded,
  Fields extends ArgFields,
  Services,
> {
  readonly query: InnerQuery<Name, Value, Encoded, Failure, FailureEncoded, Fields, Services>;
  readonly Model: CachedModel<this["query"]["Model"]>;
  readonly Message: CachedMessage<Fields, this["query"]["Message"]>;
  readonly CheckFreshness: CheckFreshnessCommand<Name, Fields, this["query"]["Message"]>;
  readonly init: () => this["Model"]["Type"];
  readonly read: (model: this["Model"]["Type"], args: ArgsOf<Fields>) => AsyncData.AsyncData<Value, Failure>;
  readonly update: (
    model: this["Model"]["Type"],
    message: this["Message"]["Type"],
  ) => Return<this["Model"]["Type"], this["Message"]["Type"], Services>;
}

type Entry = Readonly<{ args: unknown; data: AsyncData.AsyncData<{ readonly fetchedAt: number }, unknown> }>;

type Kept = Readonly<{
  query: Readonly<{ entries: HashMap.HashMap<string, Entry>; generation: number }>;
  recent: readonly string[];
}>;

const touch = <Model extends Kept>(model: Model, key: string, maxEntries: number): Model => {
  const used = Arr.append(
    Arr.filter(model.recent, (recentKey) => recentKey !== key),
    key,
  );

  const [dropped, recent] = Arr.splitAt(used, used.length - maxEntries);

  return { ...model, query: { ...model.query, entries: HashMap.removeMany(model.query.entries, dropped) }, recent };
};

const fetchedAtOf = (model: Kept, key: string): Option.Option<number> =>
  HashMap.get(model.query.entries, key).pipe(
    Option.flatMap(({ data: entryData }) => AsyncData.getData(entryData)),
    Option.map(({ fetchedAt }) => fetchedAt),
  );

const stampedQuery = <Name extends string, Value, Encoded, Failure, FailureEncoded, Fields extends ArgFields, Services>(
  config: CachedQueryConfig<Name, Value, Encoded, Failure, FailureEncoded, Fields, Services>,
): InnerQuery<Name, Value, Encoded, Failure, FailureEncoded, Fields, Services> =>
  defineQuery({
    args: config.args,
    data: Schema.Struct({ fetchedAt: Schema.Finite, value: config.data }),
    error: config.error,
    execute: (args: ArgsOf<Fields>) =>
      Effect.zipWith(config.execute(args), Clock.currentTimeMillis, (value, fetchedAt) => ({ fetchedAt, value })),
    name: config.name,
    toKey: config.toKey,
  });

const messagesOf = <Fields extends ArgFields, Reply extends Schema.Top>(
  args: ArgsCodec<Fields>,
  reply: Schema.Codec<Reply["Type"], Reply["Encoded"]>,
): CachedMessage<Fields, Reply> =>
  defineMessageUnion({
    CheckedFreshness: { args, now: Schema.Finite },
    GotQueryMessage: { message: reply },
    Requested: { args },
  });

const checkFreshnessOf = <Name extends string, Fields extends ArgFields, Reply extends Schema.Top>(
  name: Name,
  args: ArgsCodec<Fields>,
  messages: CachedMessage<Fields, Reply>,
): CheckFreshnessCommand<Name, Fields, Reply> =>
  Command.define(`CheckFreshness${name}`, {
    args: { args },
    execute: ({ args: checked }) =>
      Effect.map(Clock.currentTimeMillis, (now) => messages.CheckedFreshness({ args: checked, now })),
    messages: [messages.CheckedFreshness],
  });

const updateOf = <Name extends string, Value, Encoded, Failure, FailureEncoded, Fields extends ArgFields, Services>(
  config: CachedQueryConfig<Name, Value, Encoded, Failure, FailureEncoded, Fields, Services>,
  cached: Omit<CachedQuery<Name, Value, Encoded, Failure, FailureEncoded, Fields, Services>, "update">,
): CachedQuery<Name, Value, Encoded, Failure, FailureEncoded, Fields, Services>["update"] => {
  type Model = typeof cached.Model.Type;

  type Message = typeof cached.Message.Type;

  type UpdateReturn = Return<Model, Message, Services>;

  const staleMillis = Duration.toMillis(Duration.fromInputUnsafe(config.staleTime));

  const queries = cached.query.lift<Model, Message>({
    parentField: "query",
    toParentMessage: (message) => cached.Message.GotQueryMessage({ message }),
  });

  const requested = (model: Model, args: ArgsOf<Fields>): UpdateReturn => {
    const touched = touch(model, config.toKey(args), config.maxEntries);
    const entryData = cached.query.read(touched.query, args);

    if (AsyncData.isPending(entryData)) {
      return { model: touched };
    }

    if (AsyncData.hasData(entryData)) {
      return { commands: [cached.CheckFreshness({ args })], model: touched };
    }

    return queries.revalidateOrLoad(touched, args);
  };

  const checkedFreshness = (model: Model, args: ArgsOf<Fields>, now: number): UpdateReturn => {
    const key = config.toKey(args);
    const touched = touch(model, key, config.maxEntries);

    if (Option.exists(fetchedAtOf(touched, key), (fetchedAt) => now - fetchedAt < staleMillis)) {
      return { model: touched };
    }

    return queries.revalidateOrLoad(touched, args);
  };

  return (model, message) =>
    cached.Message.match<UpdateReturn>(message, {
      CheckedFreshness: ({ args, now }) => checkedFreshness(model, args, now),
      GotQueryMessage: ({ message: queryMessage }) => queries.fold(model, queryMessage),
      Requested: ({ args }) => requested(model, args),
    });
};

const define = <
  Name extends string,
  Value,
  Encoded,
  Failure,
  FailureEncoded,
  Fields extends ArgFields,
  Services = never,
>(
  config: CachedQueryConfig<Name, Value, Encoded, Failure, FailureEncoded, Fields, Services>,
): CachedQuery<Name, Value, Encoded, Failure, FailureEncoded, Fields, Services> => {
  const query = stampedQuery(config);
  const args: ArgsCodec<Fields> = Schema.Struct(config.args);
  const Message = messagesOf<Fields, typeof query.Message>(args, query.Message);
  const Model = Schema.Struct({ query: query.Model, recent: Schema.Array(Schema.String) });

  const cached = {
    CheckFreshness: checkFreshnessOf(config.name, args, Message),
    Message,
    Model,
    init: (): typeof Model.Type => ({ query: query.init(), recent: [] }),
    query,
    read: (model: typeof Model.Type, readArgs: ArgsOf<Fields>): AsyncData.AsyncData<Value, Failure> =>
      AsyncData.map(query.read(model.query, readArgs), ({ value }) => value),
  };

  return { ...cached, update: updateOf(config, cached) };
};

export { define };

export type { CachedQuery, CachedQueryConfig };
