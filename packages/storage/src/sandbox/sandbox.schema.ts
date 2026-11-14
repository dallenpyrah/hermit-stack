import { Schema } from "effect";

const SandboxId = Schema.String.pipe(Schema.brand("SandboxId"));

type SandboxId = typeof SandboxId.Type;

const Output = Schema.Struct({
  bytes: Schema.Uint8Array,
  channel: Schema.Literals(["stdout", "stderr"]),
});

type Output = typeof Output.Type;

export { Output, SandboxId };
