import { baselineOf, staleBaselineOf, summaryOf, verdictsOf } from "../../src/mutants/mutants.pure.mjs";

const failures = [];
const expect = (holds, message) => {
  if (!holds) {
    failures.push(message);
  }
};
const form = /^[^]+\. [^]+\. Fix: [^]+\.$/u;

const packageRoot = "/repo/packages/core";
const mutant = (id, line) => ({
  description: `replace pick${line} -> boolean with true`,
  file: `${packageRoot}/src/pick.ts`,
  id,
  span: { end: { column: 9, line }, start: { column: 3, line } },
});
const result = (id, line, outcome) => ({ mutant: mutant(id, line), outcome });
const report = (results) => ({ results, root: packageRoot });
const reason = { at: "src/pick.ts:1:3", mutant: "replace pick1 with true", reason: "pick1 already returns true" };

const cases = [
  ["every mutant caught", report([result("a", 1, "caught"), result("b", 2, "unviable")]), {}, false, []],
  [
    "a missed mutant",
    report([result("a", 1, "missed")]),
    {},
    false,
    ["missed src/pick.ts:1:3 replace pick1 with true [a]."],
  ],
  ["a missed mutant listed as equivalent", report([result("a", 1, "missed")]), { a: reason }, true, []],
  [
    "each surviving outcome",
    report([result("a", 1, "untested"), result("b", 2, "timeout"), result("c", 3, "unreliable")]),
    {},
    false,
    ["untested src/pick.ts:1:3", "timeout src/pick.ts:2:3", "unreliable src/pick.ts:3:3"],
  ],
  [
    "an equivalent entry without a reason",
    report([result("a", 1, "missed")]),
    { a: { ...reason, reason: " " } },
    false,
    ["mutants.equivalent.json lists a without a reason."],
  ],
  [
    "an equivalent entry the tests now catch",
    report([result("a", 1, "caught")]),
    { a: reason },
    false,
    ["mutants.equivalent.json lists a, which is now caught."],
  ],
  [
    "an equivalent entry a full run no longer generates",
    report([]),
    { a: reason },
    true,
    ["mutants.equivalent.json lists a, which this run no longer generates."],
  ],
  ["an equivalent entry outside a diff run", report([]), { a: reason }, false, []],
  [
    "a failed baseline",
    { ...report([]), failure: "BaselineFailed: vitest run\nFAIL src/pick.test.ts" },
    {},
    false,
    ["mutant-cafe could not finish: BaselineFailed: vitest run."],
  ],
];
const known = { at: "src/pick.ts:1:3", mutant: "replace pick1 with true" };
expect(staleBaselineOf({}, []).length === 0, "an empty baseline needs no generated ids");
expect(
  staleBaselineOf({ a: known }, [mutant("a", 1), mutant("b", 2)]).length === 0,
  "a generated baseline id stays valid independently of a selected outcome report",
);
const [staleBaseline] = staleBaselineOf({ a: known, stale: known }, [mutant("a", 1)]);
expect(
  staleBaseline.startsWith("mutants.baseline.json lists stale, which current sources no longer generate.") &&
    form.test(staleBaseline),
  `a baseline id absent from complete enumeration fails: ${staleBaseline}`,
);
const baselineCases = [
  ["a survivor in the baseline", report([result("a", 1, "missed")]), { a: known }, true, []],
  [
    "a new survivor beside the baseline",
    report([result("a", 1, "missed"), result("b", 2, "missed")]),
    { a: known },
    true,
    ["missed src/pick.ts:2:3"],
  ],
  [
    "a baseline survivor the tests now kill",
    report([result("a", 1, "caught")]),
    { a: known },
    false,
    ["mutants.baseline.json lists a, which is now caught."],
  ],
];
for (const [label, given, baseline, all, expected] of baselineCases) {
  const verdicts = verdictsOf({ all, baseline, equivalents: {}, report: given });
  expect(
    verdicts.length === expected.length && expected.every((start, index) => verdicts[index].startsWith(start)),
    `${label}: ${JSON.stringify(verdicts)}`,
  );
}
expect(
  JSON.stringify(
    baselineOf(report([result("a", 1, "missed"), result("b", 2, "caught"), result("c", 3, "timeout")])),
  ) === JSON.stringify({ a: known, c: { at: "src/pick.ts:3:3", mutant: "replace pick3 with true" } }),
  "baselineOf keeps every surviving outcome",
);
for (const [label, given, equivalents, all, expected] of cases) {
  const verdicts = verdictsOf({ all, equivalents, report: given });
  expect(
    verdicts.length === expected.length && expected.every((start, index) => verdicts[index].startsWith(start)),
    `${label}: ${JSON.stringify(verdicts)}`,
  );
  for (const verdict of verdicts) {
    expect(form.test(verdict), `message not in <what>. <why>. Fix: <step>. form: ${verdict}`);
  }
}
const [missed] = verdictsOf({ all: false, equivalents: {}, report: report([result("a", 1, "missed")]) });
expect(
  missed.includes(JSON.stringify({ a: { at: "src/pick.ts:1:3", mutant: "replace pick1 with true", reason: "" } })),
  `the verdict offers a ready entry: ${missed}`,
);
expect(
  summaryOf(report([result("a", 1, "caught"), result("b", 2, "caught"), result("c", 3, "missed")])) ===
    "2 caught, 1 missed, 0 timeout, 0 unviable, 0 untested, 0 unreliable",
  "summary counts each outcome",
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  "mutants.pure: survivors, equivalents with reasons, the survivor baseline, stale entries and a failed baseline",
);
