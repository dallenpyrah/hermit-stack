import { Array as Arr, Function as Fn, Option, pipe } from "effect";

import { bucket } from "#src/evaluate/bucket.pure.js";
import type { Flag } from "#src/flag/flag.pure.js";

interface Rule<Value> {
  readonly percentage?: number;
  readonly subjects?: readonly string[];
  readonly value: Value;
}

const evaluateArity = 3;

const conditionMatches = <Value>(flagName: string, rule: Rule<Value>, subject: string): boolean =>
  pipe(
    Option.fromUndefinedOr(rule.subjects),
    Option.exists((subjects) => Arr.contains(subjects, subject)),
  ) ||
  pipe(
    Option.fromUndefinedOr(rule.percentage),
    Option.exists((percentage) => bucket(flagName, subject) < percentage),
  );

const isUnconditional = <Value>(rule: Rule<Value>): boolean =>
  Option.isNone(Option.fromUndefinedOr(rule.subjects)) && Option.isNone(Option.fromUndefinedOr(rule.percentage));

const matches = <Value>(flagName: string, rule: Rule<Value>, subject: Option.Option<string>): boolean =>
  isUnconditional(rule) || Option.exists(subject, (id) => conditionMatches(flagName, rule, id));

const evaluate: {
  <Value>(rules: readonly Rule<Value>[], subject: Option.Option<string>): (flag: Flag<Value>) => Value;
  <Value>(flag: Flag<Value>, rules: readonly Rule<Value>[], subject: Option.Option<string>): Value;
} = Fn.dual(
  evaluateArity,
  <Value>(flag: Flag<Value>, rules: readonly Rule<Value>[], subject: Option.Option<string>): Value =>
    pipe(
      Arr.findFirst(rules, (rule) => matches(flag.name, rule, subject)),
      Option.match({ onNone: () => flag.default, onSome: (rule) => rule.value }),
    ),
);

export { evaluate };

export type { Rule };
