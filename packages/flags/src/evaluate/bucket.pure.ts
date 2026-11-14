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

// FNV-1a over the code points, then MurmurHash3's fmix32 finaliser, so another language can reproduce a bucket.
// Without the finaliser, subjects that differ only in their last character, such as user-1 and user-2, land side by
// Side and a 20% rollout reaches a run of consecutive ids instead of a fifth of them.
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

// The subject's place in [0, 100) for one flag, the same on every host. A NUL joins the two because a flag name cannot
// Contain one, so no other name and subject pair hashes the same text.
const bucket: {
  (subject: string): (flagName: string) => number;
  (flagName: string, subject: string): number;
} = Fn.dual(
  bucketArity,
  (flagName: string, subject: string): number => (hash(`${flagName}\u0000${subject}`) / hashRange) * percent,
);

export { bucket };
