import { Schema } from "effect";

// Chosen by the adapter that started the sandbox; callers hand it back but never parse it.
const SandboxId = Schema.String.pipe(Schema.brand("SandboxId"));

type SandboxId = typeof SandboxId.Type;

// One piece of what a command printed, in the order it printed it.
const Output = Schema.Struct({
  bytes: Schema.Uint8Array,
  channel: Schema.Literals(["stdout", "stderr"]),
});

type Output = typeof Output.Type;

export { Output, SandboxId };
