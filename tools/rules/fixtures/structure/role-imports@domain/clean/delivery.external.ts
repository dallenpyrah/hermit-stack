import { Domain } from "@alchemy.run/domain";
import { errors } from "./dependency.errors.ts";
import { id } from "./dependency.id.ts";
import { rejection } from "./dependency.rejection.ts";
import { schema } from "./dependency.schema.ts";

export const delivery = [Domain, errors, id, rejection, schema];
