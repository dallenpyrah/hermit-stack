import { describe, it } from "@effect/vitest";
import { Layer } from "effect";

import { DisksFake } from "#tests/disk/disks.fake";

import { SandboxesFake } from "./sandboxes.fake.js";
import { sandboxesContract } from "./sandboxes.suite.js";

describe("the in-memory sandboxes", () => {
  for (const [title, run] of sandboxesContract(Layer.provideMerge(SandboxesFake, DisksFake))) {
    it.live(title, run);
  }
});
