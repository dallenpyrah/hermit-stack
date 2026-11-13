import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

class Armed extends Event("Armed", { cron: Schema.String, nextDue: Schema.DateTimeUtc, timeZone: Schema.String }) {}

export { Armed };
