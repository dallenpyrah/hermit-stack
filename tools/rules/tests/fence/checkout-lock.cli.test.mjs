import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { argumentsOf, holderLine, timedOutMessage } from "../../src/fence/checkout-lock.pure.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const cli = path.join(root, "src", "fence", "checkout-lock.cli.mjs");
const failures = [];
const expect = (holds, message) => {
  if (!holds) {
    failures.push(message);
  }
};
const form = /^.+\. .+\. Fix: .+\.$/u;
const stamp = "node -e 'console.log(Date.now())'";

expect(
  JSON.stringify(argumentsOf(["read", "../akter", "../rules"])) ===
    JSON.stringify({ checkouts: ["../akter", "../rules"], mode: "read" }),
  "read takes one or more checkouts",
);
expect(
  JSON.stringify(argumentsOf(["write", "../akter", "--", "git", "merge"])) ===
    JSON.stringify({ checkouts: ["../akter"], command: ["git", "merge"], mode: "write" }),
  "write takes one checkout, --, then the command",
);
for (const argv of [
  [],
  ["read"],
  ["write", "../akter", "git"],
  ["write", "../akter", "--"],
  ["write", "a", "b", "--", "c"],
]) {
  expect(argumentsOf(argv) === undefined, `${JSON.stringify(argv)} is a usage error`);
}
const line = holderLine({ label: "RILA-13 check", pid: 42, since: "2026-11-08T09:10:11.000Z" });
expect(line === "RILA-13 check (pid 42) since 09:10:11Z", `a holder line names the label, pid and start: ${line}`);
for (const mode of ["read", "write"]) {
  const message = timedOutMessage(mode, "../akter", [line], 30);
  expect(form.test(message), `${mode} time-out is not in <what>. <why>. Fix: <step>. form: ${message}`);
}

const repo = mkdtempSync(path.join(tmpdir(), "checkout-lock-"));
execFileSync("git", ["init", "--quiet", repo]);
const lock = path.join(repo, ".git", "checkout-lock");

const started = (command, env = {}) => {
  const child = spawn("sh", ["-c", command], { env: { ...process.env, CHECKOUT_LOCK_MINUTES: "0.25", ...env } });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const done = new Promise((resolve) => {
    child.on("close", (code) => resolve({ code, stderr, stdout }));
  });
  return { child, done };
};
const ran = (command, env) => started(command, env).done;
const until = async (holds) => {
  for (let tries = 0; tries < 100 && !holds(); tries += 1) {
    await sleep(50);
  }
  return holds();
};
const readersOf = () => (existsSync(path.join(lock, "readers")) ? readdirSync(path.join(lock, "readers")) : []);
const writing = () => existsSync(path.join(lock, "writer", "holder.json"));

const orphan = await ran(
  `node -e "require('node:child_process').spawn(process.execPath, ['${cli}', 'read', '${repo}'], { detached: true, stdio: 'ignore' }).unref()"; sleep 1`,
);
expect(
  orphan.code === 0 && readersOf().length === 0,
  `a read whose script already exited registers nothing: ${readersOf()}`,
);

const usage = await ran(`node ${cli}`);
expect(
  usage.code === 2 && usage.stderr.includes("usage: checkout-lock"),
  `no arguments exit 2 with usage: ${usage.code}`,
);

const reader = started(`node ${cli} read ${repo} && sleep 1.5 && ${stamp}`, { HEAVY_LABEL: "first check" });
expect(
  await until(() => readersOf().includes(String(reader.child.pid))),
  `read registers its script's pid as a reader: ${readersOf()}`,
);
const landing = started(`node ${cli} write ${repo} -- ${stamp}`);
expect(await until(writing), "a waiting landing claims the checkout before the readers drain");
const readerIdentity = JSON.parse(readFileSync(path.join(lock, "readers", String(reader.child.pid)), "utf8"));
const writerIdentity = JSON.parse(readFileSync(path.join(lock, "writer", "holder.json"), "utf8"));
expect(
  typeof readerIdentity.startedAt === "string" && readerIdentity.startedAt.length > 0,
  "a reader records no process start time",
);
expect(
  typeof writerIdentity.startedAt === "string" && writerIdentity.startedAt.length > 0,
  "a writer records no process start time",
);
const late = started(`node ${cli} read ${repo} && ${stamp}`);
const [readDone, landed, lateDone] = await Promise.all([reader.done, landing.done, late.done]);
expect(
  landed.code === 0 && Number(landed.stdout) >= Number(readDone.stdout),
  `write runs its command only after the check reading the checkout ends: ${landed.stdout} vs ${readDone.stdout}`,
);
expect(
  lateDone.code === 0 && Number(lateDone.stdout) >= Number(landed.stdout),
  `a check that arrives while a landing waits goes after the landing: ${lateDone.stdout} vs ${landed.stdout}`,
);
expect(
  landed.stderr.includes("held by: first check (pid"),
  `write names the reader it waits for by label and pid: ${landed.stderr}`,
);
expect(
  lateDone.stderr.includes("waiting for the landing on"),
  `the late reader says what it waits for: ${lateDone.stderr}`,
);
expect(!writing(), "write releases the checkout when its command ends");

const writer = started(`node ${cli} write ${repo} -- node -e 'setTimeout(() => console.log(Date.now()), 1500)'`);
expect(await until(writing), "write holds the checkout while its command runs");
const blocked = await ran(`node ${cli} read ${repo} && ${stamp}`);
const writeDone = await writer.done;
expect(
  blocked.code === 0 && Number(blocked.stdout) >= Number(writeDone.stdout),
  `read returns only after the landing's command ends: ${blocked.stdout} vs ${writeDone.stdout}`,
);

const nested = await ran(`node ${cli} write ${repo} -- sh -c "node ${cli} read ${repo} && echo nested"`, {
  CHECKOUT_LOCK_MINUTES: "0.05",
});
expect(
  nested.code === 0 && nested.stdout.includes("nested"),
  `a check the landing itself runs reads through its lock: ${nested.stderr}`,
);

const killed = started(`node ${cli} read ${repo} && sleep 30`);
expect(await until(() => readersOf().includes(String(killed.child.pid))), "the reader to kill registers");
const waiting = started(`node ${cli} write ${repo} -- ${stamp}`);
expect(await until(writing), "the landing waits for the reader to kill");
const killedAt = Date.now();
killed.child.kill("SIGKILL");
const afterKill = await waiting.done;
expect(
  afterKill.code === 0 && Number(afterKill.stdout) - killedAt < 3000,
  `a reader killed mid-check is reclaimed and the landing proceeds: ${afterKill.code} after ${Number(afterKill.stdout) - killedAt} ms`,
);
expect(!readersOf().includes(String(killed.child.pid)), "the killed reader's entry is removed");

const deadPid = spawnSync("true").pid;
const deadHolder = JSON.stringify({ label: "crashed", pid: deadPid, since: new Date().toISOString() });
mkdirSync(path.join(lock, "readers"), { recursive: true });
writeFileSync(path.join(lock, "readers", String(deadPid)), deadHolder);
mkdirSync(path.join(lock, "writer"), { recursive: true });
writeFileSync(path.join(lock, "writer", "holder.json"), deadHolder);
const before = Date.now();
const afterCrash = await ran(`node ${cli} write ${repo} -- node -e 'process.exit(3)'`);
expect(afterCrash.code === 3, `write exits with its command's code: ${afterCrash.code}`);
expect(Date.now() - before < 5000, "a dead reader and a dead writer don't hold the checkout");
expect(!readersOf().includes(String(deadPid)), "write prunes a dead reader's entry");

const longReader = started(`node ${cli} read ${repo} && sleep 10`, { HEAVY_LABEL: "RILA-13 akter-cloud check" });
expect(await until(() => readersOf().includes(String(longReader.child.pid))), "the long reader registers");
const marker = path.join(repo, "landed");
const timedOut = await ran(`node ${cli} write ${repo} -- touch ${marker}`, { CHECKOUT_LOCK_MINUTES: "0.02" });
const lastLine = timedOut.stderr.trim().split("\n").at(-1);
expect(
  timedOut.code === 1 && !existsSync(marker),
  `write gives up without landing once its wait runs out: ${timedOut.code}`,
);
expect(form.test(lastLine), `the time-out is not in <what>. <why>. Fix: <step>. form: ${lastLine}`);
expect(
  new RegExp(
    `held by: RILA-13 akter-cloud check \\(pid ${longReader.child.pid}\\) since \\d\\d:\\d\\d:\\d\\dZ`,
    "u",
  ).test(lastLine),
  `the time-out names the holder's label, pid and start: ${lastLine}`,
);
expect(!writing(), "write releases the checkout when it gives up");
longReader.child.kill("SIGKILL");
await longReader.done;

const actualStart = execFileSync("ps", ["-o", "lstart=", "-p", String(process.pid)], {
  encoding: "utf8",
  env: { LC_ALL: "C", TZ: "UTC" },
})
  .trim()
  .replace(/\s+/gu, " ");
const wrongStart = "Thu Jan 1 00:00:00 1970";
expect(actualStart !== wrongStart, "the reused-PID control has the actual process start time");
const reusedEntry = { pid: process.pid, since: new Date().toISOString(), startedAt: wrongStart };
const reusedReader = path.join(lock, "readers", String(process.pid));
writeFileSync(reusedReader, JSON.stringify({ ...reusedEntry, label: "reused reader owner" }));
mkdirSync(path.join(lock, "writer"), { recursive: true });
writeFileSync(
  path.join(lock, "writer", "holder.json"),
  JSON.stringify({ ...reusedEntry, label: "reused writer owner" }),
);
const reclaimedMarker = path.join(repo, "reused-pid-reclaimed");
const reclaimed = await ran(`node ${cli} write ${repo} -- touch ${reclaimedMarker}`, { CHECKOUT_LOCK_MINUTES: "0.01" });
expect(
  reclaimed.code === 0 && existsSync(reclaimedMarker),
  "a reused PID holds the checkout despite a different process start time",
);
expect(!existsSync(reusedReader) && !writing(), "the writer leaves a proven stale reader or writer entry");
expect(
  reclaimed.stderr.includes("stale reader") && reclaimed.stderr.includes("reused reader owner"),
  "the writer does not report the stale reader owner",
);
expect(
  reclaimed.stderr.includes("stale writer") && reclaimed.stderr.includes("reused writer owner"),
  "the writer does not report the stale writer owner",
);
process.kill(process.pid, 0);
rmSync(reusedReader, { force: true });
rmSync(path.join(lock, "writer"), { recursive: true, force: true });

const unverifiableMarker = path.join(repo, "unverifiable-must-not-land");
writeFileSync(
  reusedReader,
  JSON.stringify({ label: "missing identity owner", pid: process.pid, since: new Date().toISOString() }),
);
const unverifiable = await ran(`node ${cli} write ${repo} -- touch ${unverifiableMarker}`, {
  CHECKOUT_LOCK_MINUTES: "0.01",
});
expect(
  unverifiable.code === 1 && !existsSync(unverifiableMarker) && existsSync(reusedReader),
  "an unverifiable live holder is silently reclaimed",
);
expect(unverifiable.stderr.includes("process identity unverifiable"), "an unverifiable holder is not explained");
expect(!writing(), "the writer leaves its own lock after refusing an unverifiable holder");
rmSync(reusedReader, { force: true });

mkdirSync(path.join(lock, "writer"), { recursive: true });
writeFileSync(
  path.join(lock, "writer", "holder.json"),
  JSON.stringify({ label: "missing ancestor identity", pid: process.pid, since: new Date().toISOString() }),
);
const ancestorMarker = path.join(repo, "unverifiable-ancestor-must-not-read");
const ancestor = await ran(`node ${cli} read ${repo} && touch ${ancestorMarker}`, { CHECKOUT_LOCK_MINUTES: "0.01" });
expect(
  ancestor.code === 1 && !existsSync(ancestorMarker) && writing(),
  "a reader bypasses an ancestor writer whose identity is unverifiable",
);
expect(ancestor.stderr.includes("process identity unverifiable"), "an unverifiable ancestor writer is not explained");
rmSync(path.join(lock, "writer"), { recursive: true, force: true });

const bin = path.join(repo, "bin");
mkdirSync(bin);
const ps = path.join(bin, "ps");
const realPs = execFileSync("sh", ["-c", "command -v ps"], { encoding: "utf8" }).trim();
writeFileSync(
  ps,
  `#!/bin/sh\nif [ "$2" = 'lstart=' ] && [ "$4" = '${process.pid}' ]; then exit 1; fi\nexec '${realPs}' "$@"\n`,
  { mode: 0o755 },
);
const probeEnv = {
  CHECKOUT_LOCK_MINUTES: "0.01",
  PATH: `${bin}:${path.dirname(process.execPath)}:/usr/bin:/bin`,
};
writeFileSync(
  reusedReader,
  JSON.stringify({ ...reusedEntry, label: "unreadable process owner", startedAt: actualStart }),
);
const unreadable = await ran(`node ${cli} write ${repo} -- touch ${unverifiableMarker}`, probeEnv);
expect(
  unreadable.code === 1 && !existsSync(unverifiableMarker) && existsSync(reusedReader),
  "a failed process-start probe discards a live reader",
);
expect(unreadable.stderr.includes("process identity unverifiable"), "a failed process-start probe is not explained");
expect(!writing(), "a failed process-start probe leaves the waiting writer's lock");
rmSync(reusedReader, { force: true });

const replacementFile = path.join(repo, "replacement-writer.json");
const replacement = JSON.stringify({ ...reusedEntry, label: "replacement live writer", startedAt: actualStart });
writeFileSync(replacementFile, replacement);
mkdirSync(path.join(lock, "writer"), { recursive: true });
writeFileSync(
  path.join(lock, "writer", "holder.json"),
  JSON.stringify({ ...reusedEntry, label: "replaced stale writer" }),
);
const swapped = path.join(repo, "writer-swapped");
writeFileSync(
  ps,
  `#!/bin/sh\nif [ "$2" = 'lstart=' ] && [ "$4" = '${process.pid}' ] && [ ! -e '${swapped}' ]; then\n  mv '${path.join(lock, "writer")}' '${path.join(repo, "old-writer")}'\n  mkdir '${path.join(lock, "writer")}'\n  cp '${replacementFile}' '${path.join(lock, "writer", "holder.json")}'\n  touch '${swapped}'\nfi\nexec '${realPs}' "$@"\n`,
);
const replacementMarker = path.join(repo, "replacement-must-not-land");
const preservedWriter = await ran(`node ${cli} write ${repo} -- touch ${replacementMarker}`, probeEnv);
expect(
  preservedWriter.code === 1 && !existsSync(replacementMarker) && writing(),
  "a delayed stale-identity probe discards a replacement live writer",
);
expect(
  writing() && readFileSync(path.join(lock, "writer", "holder.json"), "utf8") === replacement,
  "a replacement writer's holder metadata changes during stale reclamation",
);
expect(
  preservedWriter.stderr.includes("replacement live writer"),
  "a stale-identity probe does not wait for the replacement writer",
);
rmSync(path.join(lock, "writer"), { recursive: true, force: true });

writeFileSync(ps, `#!/bin/sh\nif [ "$2" = 'lstart=' ]; then exit 1; fi\nexec '${realPs}' "$@"\n`);
const noIdentity = await ran(`node ${cli} write ${repo} -- touch ${unverifiableMarker}`, probeEnv);
expect(
  noIdentity.code === 1 && !existsSync(unverifiableMarker) && !writing(),
  "a writer registers without a verifiable process identity",
);
process.kill(process.pid, 0);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("checkout-lock: ok");
