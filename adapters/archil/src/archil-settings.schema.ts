import { Schema } from "effect";

// How the adapter reaches Archil. The key is an account API key from Archil's console. The region decides where new
// Disks live (Archil's own ids, such as "aws-us-east-1", the default); a base URL replaces the region's control plane,
// As the tests do with their local stand-in. The prefix goes in front of every disk name this adapter creates, so two
// Products or stages can share one Archil account.
const ArchilSettings = Schema.Struct({
  apiBaseUrl: Schema.optionalKey(Schema.String),
  apiKey: Schema.Redacted(Schema.String),
  diskPrefix: Schema.String,
  region: Schema.optionalKey(Schema.String),
});

type ArchilSettings = typeof ArchilSettings.Type;

export { ArchilSettings };
