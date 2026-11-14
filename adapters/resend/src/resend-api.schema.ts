import { Schema } from "effect";

const SentEmail = Schema.Struct({ id: Schema.String });

const ResendError = Schema.Struct({ message: Schema.String, name: Schema.String });

type ResendError = typeof ResendError.Type;

export { ResendError, SentEmail };
