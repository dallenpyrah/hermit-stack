import { describe, it } from "@effect/vitest";
import { disksContract } from "@repo/storage/disks-suite";
import { sandboxesContract } from "@repo/storage/sandboxes-suite";

import { ArchilStandIn } from "#tests/archil-storage.fake";

describe("the Archil disks against a local stand-in for Archil", () => {
  for (const [title, run] of disksContract(ArchilStandIn)) {
    it.live(title, run);
  }
});

describe("the Archil sandboxes against a local stand-in for Archil", () => {
  for (const [title, run] of sandboxesContract(ArchilStandIn)) {
    it.live(title, run);
  }
});
