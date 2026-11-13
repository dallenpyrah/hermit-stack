const surviving = new Set(["missed", "untested", "timeout", "unreliable"]);

const killed = new Set(["caught", "unviable"]);

const locationOf = (root, mutant) =>
  `${mutant.file.startsWith(`${root}/`) ? mutant.file.slice(root.length + 1) : mutant.file}:${mutant.span.start.line}:${mutant.span.start.column}`;

const entryOf = (root, result) => ({
  at: locationOf(root, result.mutant),
  mutant: result.mutant.description.replace(/ -> .*? with /u, " with "),
});

const staleIn = (file, list, results, all) =>
  Object.keys(list).flatMap((id) => {
    const result = results.get(id);
    if (result !== undefined && killed.has(result.outcome)) {
      return [
        `${file} lists ${id}, which is now ${result.outcome}. A stale entry would hide the next mutant with that id. Fix: delete it.`,
      ];
    }
    if (result === undefined && all) {
      return [
        `${file} lists ${id}, which this run no longer generates. A stale entry would hide the next mutant with that id. Fix: delete it.`,
      ];
    }
    return [];
  });

const verdictsOf = ({ all, baseline = {}, equivalents, report }) => {
  if (report.failure !== undefined) {
    return [
      `mutant-cafe could not finish: ${report.failure.split("\n")[0]}. A mutant counts only against a passing baseline. Fix: make the package's tests pass, then rerun.`,
    ];
  }
  const results = new Map(report.results.map((result) => [result.mutant.id, result]));
  const unexplained = Object.entries(equivalents)
    .filter(([, entry]) => typeof entry?.reason !== "string" || entry.reason.trim() === "")
    .map(
      ([id]) =>
        `mutants.equivalent.json lists ${id} without a reason. An equivalent mutant needs the reason no test can tell it apart. Fix: write the reason, or kill the mutant with a test and delete the entry.`,
    );
  const survivors = report.results
    .filter(
      (result) =>
        surviving.has(result.outcome) &&
        !Object.hasOwn(equivalents, result.mutant.id) &&
        !Object.hasOwn(baseline, result.mutant.id),
    )
    .map((result) => {
      const entry = entryOf(report.root, result);
      return `${result.outcome} ${entry.at} ${entry.mutant} [${result.mutant.id}]. A mutant that survives is a change no test notices. Fix: add a test that fails on it, or list it in mutants.equivalent.json as ${JSON.stringify({ [result.mutant.id]: { ...entry, reason: "" } })} with the reason.`;
    });
  return [
    ...unexplained,
    ...survivors,
    ...staleIn("mutants.equivalent.json", equivalents, results, all),
    ...staleIn("mutants.baseline.json", baseline, results, all),
  ];
};

const baselineOf = (report) =>
  Object.fromEntries(
    report.results
      .filter((result) => surviving.has(result.outcome))
      .map((result) => [result.mutant.id, entryOf(report.root, result)]),
  );

const staleBaselineOf = (baseline, mutants) => {
  if (!Array.isArray(mutants) || mutants.some((mutant) => typeof mutant?.id !== "string" || mutant.id.trim() === "")) {
    throw new Error("Current mutant enumeration must list non-empty string IDs");
  }
  const generated = new Set(mutants.map((mutant) => mutant.id));
  return Object.keys(baseline)
    .filter((id) => !generated.has(id))
    .map(
      (id) =>
        `mutants.baseline.json lists ${id}, which current sources no longer generate. A stale entry would hide the next mutant with that id. Fix: delete it.`,
    );
};

const summaryOf = (report) => {
  const counts = Object.groupBy(report.results, (result) => result.outcome);
  return ["caught", "missed", "timeout", "unviable", "untested", "unreliable"]
    .map((outcome) => `${counts[outcome]?.length ?? 0} ${outcome}`)
    .join(", ");
};

export { baselineOf, staleBaselineOf, summaryOf, verdictsOf };
