const usage = "usage: checkout-lock read <checkout>... | checkout-lock write <checkout> -- <command> [args...]";

const why =
  "A check that reads a sibling checkout while a landing moves it sees two versions at once and fails on a mismatch nothing in the change caused";

const argumentsOf = (argv) => {
  const [mode, ...rest] = argv;
  if (mode === "read" && rest.length > 0 && !rest.includes("--")) {
    return { checkouts: rest, mode };
  }
  if (mode === "write" && rest.length > 2 && rest[1] === "--") {
    return { checkouts: [rest[0]], command: rest.slice(2), mode };
  }
  return undefined;
};

const holderLine = ({ label, pid, since, identityUnverifiable }) =>
  `${label} (pid ${pid}) since ${since.slice(11, 19)}Z${identityUnverifiable ? "; process identity unverifiable" : ""}`;

const waitingMessage = (mode, checkout, holders) =>
  mode === "read"
    ? `checkout-lock: waiting for the landing on ${checkout}; held by: ${holders.join("; ")}`
    : `checkout-lock: waiting for ${holders.length} holder(s) of ${checkout}; held by: ${holders.join("; ")}`;

const timedOutMessage = (mode, checkout, holders, minutes) =>
  mode === "read"
    ? `checkout-lock: the landing on ${checkout} still holds it after ${minutes} minutes; held by: ${holders.join("; ")}. ${why}. Fix: let the landing finish, then rerun.`
    : `checkout-lock: ${checkout} is still held after ${minutes} minutes; held by: ${holders.join("; ")}. ${why}. Fix: wait for those holders to finish or stop them, then land again.`;

export { argumentsOf, holderLine, timedOutMessage, usage, waitingMessage };
