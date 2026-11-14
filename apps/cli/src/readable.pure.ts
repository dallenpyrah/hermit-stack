import { Array as Arr, Option, Predicate, Record as Rec, Schema, String as Str } from "effect";

type Json = Schema.Json;

interface Block {
  readonly heading: string;
  readonly lines: readonly string[];
}

const step = "  ";

const tagKey = "_tag";

const isJsonArray = Schema.is(Schema.Array(Schema.Json));

const container = (empty: string, lines: readonly string[]): Block => {
  if (Arr.isReadonlyArrayEmpty(lines)) {
    return { heading: empty, lines };
  }

  return { heading: "", lines };
};

const named = (prefix: string, block: Block): string => {
  if (block.heading === "") {
    return prefix;
  }

  return `${prefix} ${block.heading}`;
};

const blockOf = (value: Json, indent: string): Block => {
  if (Predicate.isString(value) || Predicate.isNumber(value) || Predicate.isBoolean(value) || Predicate.isNull(value)) {
    return { heading: `${value}`, lines: [] };
  }

  const inner = indent + step;

  if (isJsonArray(value)) {
    return container(
      "[]",
      Arr.flatMap(value, (item) => {
        const block = blockOf(item, inner);

        return [named(`${indent}-`, block), ...block.lines];
      }),
    );
  }

  const tag = Option.filter(Option.fromNullishOr(value[tagKey]), Predicate.isString);

  const fields = Arr.flatMap(Rec.toEntries(value), ([key, field]) => {
    if (Predicate.isNull(field) || (Option.isSome(tag) && key === tagKey)) {
      return [];
    }

    const block = blockOf(field, inner);

    return [named(`${indent}${key}:`, block), ...block.lines];
  });

  return Option.match(tag, {
    onNone: () => container("{}", fields),
    onSome: (heading) => ({ heading, lines: fields }),
  });
};

const readable = (value: Json): string => {
  const block = blockOf(value, step);

  if (block.heading === "") {
    return Arr.join(Arr.map(block.lines, Str.slice(step.length)), "\n");
  }

  return Arr.join([block.heading, ...block.lines], "\n");
};

export { readable };
