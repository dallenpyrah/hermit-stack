import type { Disks, Sandboxes } from "@repo/storage";
import { Layer } from "effect";

import type { ArchilSettings } from "./archil-settings.schema.js";
import { ArchilDisks } from "./disk/archil-disks.layer.js";
import { ArchilSandboxes } from "./sandbox/archil-sandboxes.layer.js";

// Both storage ports on one Archil account, the way a service composes them for a target.
const ArchilStorage = (settings: ArchilSettings): Layer.Layer<Disks | Sandboxes> =>
  Layer.mergeAll(ArchilDisks(settings), ArchilSandboxes(settings));

export { ArchilStorage };

export { ArchilSettings } from "./archil-settings.schema.js";
