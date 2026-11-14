import { Function as Fn, Option, String as Str, pipe } from "effect";

const fnvOffset = 2_166_136_261;
const fnvPrime = 16_777_619;
const mixFirst = 2_246_822_507;
const mixSecond = 3_266_489_909;
const shiftWide = 16;
const shiftNarrow = 13;
const unsigned = 0;
const firstUnit = 0;
const hashRange = 4_294_967_296;
const percent = 100;
const bucketArity = 2;

const hash = (input: string): number => {
  let state = fnvOffset;

  for (const character of input) {
    const codePoint = pipe(character, Str.codePointAt(firstUnit), Option.getOrElse(Fn.constant(firstUnit)));

    state = Math.imul(state ^ codePoint, fnvPrime);
  }

  state ^= state >>> shiftWide;
  state = Math.imul(state, mixFirst);
  state ^= state >>> shiftNarrow;
  state = Math.imul(state, mixSecond);
  state ^= state >>> shiftWide;

  return state >>> unsigned;
};

const bucket: {
  (subject: string): (flagName: string) => number;
  (flagName: string, subject: string): number;
} = Fn.dual(
  bucketArity,
  (flagName: string, subject: string): number => (hash(`${flagName}\u0000${subject}`) / hashRange) * percent,
);

export { bucket };
