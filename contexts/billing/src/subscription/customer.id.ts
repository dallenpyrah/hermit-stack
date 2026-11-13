import { Schema } from "effect";

// The app's own id for whoever pays, never the processor's: the processor's ids stay in its adapter and in opaque
// References, so changing processor keeps every key.
const CustomerId = Schema.String.pipe(Schema.brand("CustomerId"));

type CustomerId = typeof CustomerId.Type;

export { CustomerId };
