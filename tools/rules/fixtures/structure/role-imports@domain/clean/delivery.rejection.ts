import { Domain } from "@alchemy.run/domain";
import { api } from "./dependency.api.ts";
import { contract } from "./dependency.contract.ts";
import { errors } from "./dependency.errors.ts";
import { schema } from "./dependency.schema.ts";
import { id } from "./dependency.id.ts";
import { pure } from "./dependency.pure.ts";

export const delivery = [Domain, api, contract, errors, schema, id, pure];
