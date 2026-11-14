import { Number as Num, Option, String as Str, pipe } from "effect";

const centsPerDollar = 100;

const centDigits = 2;

const noCents = 0;

const dollars = new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" });

// The ledger counts whole cents; a person reads dollars.
const formatCents = (cents: number): string => dollars.format(cents / centsPerDollar);

// Dollars with at most two decimals, such as 12, 12.5 or $12.50. Anything else, and zero, is not an amount.
const amountPattern = /^\$?(?<whole>\d{1,9})(?:\.(?<fraction>\d{1,2}))?$/u;

const padCents = Str.padEnd(centDigits, "0");

const centsOf = ({ fraction = "", whole = "" }: Readonly<Record<string, string>>): Option.Option<number> => {
  const parts = Option.all([Num.parse(whole), Num.parse(padCents(fraction))]);

  return Option.map(parts, ([dollarsPart, centsPart]) => dollarsPart * centsPerDollar + centsPart);
};

const groupsOf = (text: string): Option.Option<Readonly<Record<string, string>>> =>
  Option.fromNullishOr(amountPattern.exec(Str.trim(text))?.groups);

const parseCents = (text: string): Option.Option<number> =>
  pipe(groupsOf(text), Option.flatMap(centsOf), Option.filter(Num.isGreaterThan(noCents)));

export { formatCents, parseCents };
