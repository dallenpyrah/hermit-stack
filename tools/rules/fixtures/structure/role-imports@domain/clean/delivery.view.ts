import { Domain } from "@alchemy.run/domain";
import { aggregate } from "./dependency.aggregate.ts";
import { command } from "./dependency.command.ts";
import { context } from "./dependency.context.ts";
import { event } from "./dependency.event.ts";
import { id } from "./dependency.id.ts";
import { middleware } from "./dependency.middleware.ts";
import { pure } from "./dependency.pure.ts";
import { rejection } from "./dependency.rejection.ts";
import { schema } from "./dependency.schema.ts";
import { service } from "./dependency.service.ts";

export const delivery = [Domain, aggregate, command, context, event, id, middleware, pure, rejection, schema, service];
