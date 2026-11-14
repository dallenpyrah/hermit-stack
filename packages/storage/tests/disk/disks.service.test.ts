import { describe, it } from "@effect/vitest";

import { DisksFake } from "./disks.fake.js";
import { disksContract } from "./disks.suite.js";

describe("the in-memory disks", () => {
  for (const [title, run] of disksContract(DisksFake)) {
    it.live(title, run);
  }
});
