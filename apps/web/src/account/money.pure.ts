import { Option, String as Str, pipe } from "effect";

const centsPerDollar = 100;

const centsDigits = 2;

const noCents = 0;

const dollars = /^(?<whole>\d{1,9})(?:\.(?<fraction>\d{1,2}))?$/u;

const usd = new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" });

const formatCents = (cents: number): string => usd.format(cents / centsPerDollar);

type Typed = Readonly<{ fraction?: string; whole?: string }>;

const toCents = ({ fraction = "", whole = "" }: Typed): number => {
  const paddedFraction = pipe(fraction, Str.padEnd(centsDigits, "0"));

  return Number(whole) * centsPerDollar + Number(paddedFraction);
};

const parseDollars = (text: string): Option.Option<number> => {
  const typed = dollars.exec(Str.trim(text))?.groups;

  return pipe(
    Option.fromNullishOr(typed),
    Option.map(toCents),
    Option.filter((cents) => cents > noCents),
  );
};

export { formatCents, parseDollars };
