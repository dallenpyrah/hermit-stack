import { Schema } from "effect";

const ArchilSettings = Schema.Struct({
  apiBaseUrl: Schema.optionalKey(Schema.String),
  apiKey: Schema.Redacted(Schema.String),
  diskPrefix: Schema.String,
  region: Schema.optionalKey(Schema.String),
});

type ArchilSettings = typeof ArchilSettings.Type;

export { ArchilSettings };
