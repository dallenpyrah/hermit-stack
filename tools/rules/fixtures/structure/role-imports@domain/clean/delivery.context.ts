import { Domain } from "@alchemy.run/domain";
import { api } from "./dependency.api.ts";
import { contract } from "./dependency.contract.ts";
import { errors } from "./dependency.errors.ts";
import { schema } from "./dependency.schema.ts";
import { context } from "./dependency.context.ts";
import { id } from "./dependency.id.ts";
import { rejection } from "./dependency.rejection.ts";

export const delivery = [Domain, api, contract, errors, schema, context, id, rejection];
