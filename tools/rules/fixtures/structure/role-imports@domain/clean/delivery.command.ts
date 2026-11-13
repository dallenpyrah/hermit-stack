import { Domain } from "@alchemy.run/domain";
import { context } from "./dependency.context.ts";
import { event } from "./dependency.event.ts";
import { id } from "./dependency.id.ts";
import { middleware } from "./dependency.middleware.ts";
import { pure } from "./dependency.pure.ts";
import { rejection } from "./dependency.rejection.ts";
import { schema } from "./dependency.schema.ts";

export const delivery = [Domain, context, event, id, middleware, pure, rejection, schema];
