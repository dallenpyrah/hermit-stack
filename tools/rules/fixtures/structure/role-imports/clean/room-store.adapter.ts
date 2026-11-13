import { SqlClient } from "effect/sql";
import { readFile } from "node:fs/promises";

export const store = [SqlClient, readFile];
