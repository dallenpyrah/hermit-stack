// What an infra stack declares on Archil, so that only this package imports it. `providers` goes in the stack's
// Providers; `Disk` declares a disk the stack owns (name it with `diskNameOf(prefix)(name)` and a running program's
// `Disks.create(name)` opens it); `Checkpoint` seeds a disk once at deploy; `Image` is a sandbox's base image.
export { Checkpoint, Disk, Image, providers } from "@alchemy.run/archil";

export { diskNameOf } from "./archil-ids.pure.js";
