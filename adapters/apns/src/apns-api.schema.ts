import { Schema } from "effect";

const ApnsError = Schema.Struct({ reason: Schema.String });

const Alert = Schema.Struct({ body: Schema.String, title: Schema.String });

const ApnsPayload = Schema.Struct({ aps: Schema.Struct({ alert: Alert }) });

export { ApnsError, ApnsPayload };
