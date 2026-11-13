import { readFileSync } from "node:fs";
import { Schema } from "effect";

export const Join = Schema.Struct({ room: Schema.String.pipe(Schema.brand(readFileSync("x", "utf8"))) });
