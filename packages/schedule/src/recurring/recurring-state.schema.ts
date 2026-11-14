import { Schema } from "effect";

const Settings = { cron: Schema.String, timeZone: Schema.String };

const Unarmed = Schema.TaggedStruct("Unarmed", {});

const Running = Schema.TaggedStruct("Running", { ...Settings, nextDue: Schema.DateTimeUtc });

const Stopped = Schema.TaggedStruct("Stopped", Settings);

const RecurringState = Schema.Union([Unarmed, Running, Stopped]);

type RecurringState = typeof RecurringState.Type;

export { RecurringState, Running, Stopped, Unarmed };
