#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { argumentsOf, holderLine, timedOutMessage, usage, waitingMessage } from "./checkout-lock.pure.mjs";

const pollMillis = 200;
const minutes = Number(process.env.CHECKOUT_LOCK_MINUTES ?? "30");
const deadline = Date.now() + minutes * 60_000;

const parsed = argumentsOf(process.argv.slice(2));
if (parsed === undefined) {
  console.error(usage);
  process.exit(2);
}

const lockOf = (checkout) =>
  path.join(
    execFileSync("git", ["-C", checkout, "rev-parse", "--absolute-git-dir"], { encoding: "utf8" }).trim(),
    "checkout-lock",
  );

const startOf = (pid) => {
  const observed = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], {
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C", TZ: "UTC" },
    timeout: 5000,
  });
  const startedAt = observed.stdout?.trim().replace(/\s+/gu, " ");
  return observed.status === 0 && startedAt ? startedAt : undefined;
};

const holderFor = (pid) => {
  const startedAt = startOf(pid);
  if (startedAt === undefined) {
    console.error(`checkout-lock: process identity unverifiable for pid ${pid}; refusing to register a holder`);
    return undefined;
  }
  return JSON.stringify({
    label: process.env.HEAVY_LABEL ?? process.cwd(),
    pid,
    since: new Date().toISOString(),
    startedAt,
  });
};

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM" ? true : error.code === "ESRCH" ? false : undefined;
  }
};

const parentOf = (pid) =>
  Number(spawnSync("ps", ["-o", "ppid=", "-p", String(pid)], { encoding: "utf8" }).stdout.trim() || "0");

const ancestors = (() => {
  const chain = [];
  for (let pid = process.ppid; pid > 1 && chain.length < 64; pid = parentOf(pid)) {
    chain.push(pid);
  }
  return chain;
})();

const holderAt = (file) => {
  try {
    const contents = readFileSync(file, "utf8");
    return { contents, holder: JSON.parse(contents) };
  } catch {
    return undefined;
  }
};

const release = (lock, label) => {
  const released = path.join(lock, `released-${label}`);
  try {
    renameSync(path.join(lock, "writer"), released);
    rmSync(released, { force: true, recursive: true });
  } catch {}
};

const liveHolder = (holder, discard) => {
  const running = alive(holder.pid);
  if (running !== false) {
    const startedAt = startOf(holder.pid);
    if (
      running !== true ||
      typeof holder.startedAt !== "string" ||
      holder.startedAt.length === 0 ||
      startedAt === undefined
    ) {
      return { ...holder, identityUnverifiable: true };
    }
    if (holder.startedAt === startedAt) {
      return holder;
    }
  }
  return discard() ? undefined : { ...holder, identityUnverifiable: true };
};

const liveWriter = (lock) => {
  const file = path.join(lock, "writer", "holder.json");
  const record = holderAt(file);
  if (record === undefined) {
    return undefined;
  }
  const { holder } = record;
  return liveHolder(holder, () => {
    console.error(`checkout-lock: reclaiming stale writer: ${holderLine(holder)}`);
    if (holderAt(file)?.contents !== record.contents) {
      return false;
    }
    release(lock, `dead-${holder.pid}`);
    return true;
  });
};

const liveReaders = (lock) => {
  const readers = path.join(lock, "readers");
  const files = existsSync(readers) ? readdirSync(readers).map((name) => path.join(readers, name)) : [];
  return files.flatMap((file) => {
    const holder = holderAt(file)?.holder;
    if (holder === undefined) {
      return [];
    }
    const live = liveHolder(holder, () => {
      console.error(`checkout-lock: removing stale reader: ${holderLine(holder)}`);
      rmSync(file, { force: true });
      return true;
    });
    return live === undefined ? [] : [live];
  });
};

const waitWhile = async (mode, checkout, holdersNow) => {
  let announced = false;
  for (;;) {
    const holders = holdersNow();
    if (holders.length === 0) {
      return true;
    }
    const described = holders.map(holderLine);
    if (Date.now() > deadline) {
      console.error(timedOutMessage(mode, checkout, described, minutes));
      return false;
    }
    if (!announced) {
      console.error(waitingMessage(mode, checkout, described));
      announced = true;
    }
    await sleep(pollMillis);
  }
};

const blockingWriter = (lock) => () => {
  const writer = liveWriter(lock);
  return writer === undefined || (!writer.identityUnverifiable && ancestors.includes(writer.pid)) ? [] : [writer];
};

const otherWriter = (lock) => () => {
  const writer = liveWriter(lock);
  return writer === undefined ? [] : [writer];
};

const read = async (checkout) => {
  if (process.ppid <= 1) {
    return false;
  }
  const holder = holderFor(process.ppid);
  if (holder === undefined) {
    return false;
  }
  const lock = lockOf(checkout);
  const entry = path.join(lock, "readers", String(process.ppid));
  mkdirSync(path.dirname(entry), { recursive: true });
  for (;;) {
    if (!(await waitWhile("read", checkout, blockingWriter(lock)))) {
      return false;
    }
    writeFileSync(entry, holder);
    if (blockingWriter(lock)().length === 0) {
      return true;
    }
    rmSync(entry, { force: true });
  }
};

const write = async (checkout, [command, ...args]) => {
  const holder = holderFor(process.pid);
  if (holder === undefined) {
    return 1;
  }
  const lock = lockOf(checkout);
  const staged = path.join(lock, `writer-${process.pid}`);
  mkdirSync(staged, { recursive: true });
  writeFileSync(path.join(staged, "holder.json"), holder);
  for (;;) {
    try {
      renameSync(staged, path.join(lock, "writer"));
      break;
    } catch {
      if (!(await waitWhile("write", checkout, otherWriter(lock)))) {
        rmSync(staged, { force: true, recursive: true });
        return 1;
      }
    }
  }
  const stop = () => {
    release(lock, String(process.pid));
    process.exit(130);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  if (!(await waitWhile("write", checkout, () => liveReaders(lock)))) {
    release(lock, String(process.pid));
    return 1;
  }
  const ran = spawnSync(command, args, { stdio: "inherit" });
  release(lock, String(process.pid));
  return ran.status ?? 1;
};

if (parsed.mode === "write") {
  process.exit(await write(parsed.checkouts[0], parsed.command));
}
for (const checkout of parsed.checkouts) {
  if (!(await read(checkout))) {
    process.exit(1);
  }
}
