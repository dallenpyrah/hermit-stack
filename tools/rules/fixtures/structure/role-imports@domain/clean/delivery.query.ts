import { Domain } from "@alchemy.run/domain";
import { id } from "./dependency.id.ts";
import { projection } from "./dependency.projection.ts";
import { schema } from "./dependency.schema.ts";
import { service } from "./dependency.service.ts";

export const delivery = [Domain, id, projection, schema, service];
