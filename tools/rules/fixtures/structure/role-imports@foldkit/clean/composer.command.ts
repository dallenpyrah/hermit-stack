import { Array as Arr } from "effect";
import * as Foldkit from "foldkit";
import { api } from "./dependency.api.ts";
import { contract } from "./dependency.contract.ts";
import { errors } from "./dependency.errors.ts";
import { schema } from "./dependency.schema.ts";
import { adapter } from "./dependency.adapter.ts";
import { command } from "./dependency.command.ts";
import { message } from "./dependency.message.ts";
import { model } from "./dependency.model.ts";
import { pure } from "./dependency.pure.ts";
import { service } from "./dependency.service.ts";
import type { Hidden } from "./hidden.layer.ts";

export const composer = (hidden: Hidden) => [Arr.empty(), Foldkit, hidden, api, contract, errors, schema, adapter, command, message, model, pure, service];
