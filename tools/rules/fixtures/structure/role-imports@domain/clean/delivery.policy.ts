import { Domain } from "@alchemy.run/domain";
import { aggregate } from "./dependency.aggregate.ts";
import { command } from "./dependency.command.ts";
import { event } from "./dependency.event.ts";
import { external } from "./dependency.external.ts";
import { id } from "./dependency.id.ts";
import { pure } from "./dependency.pure.ts";
import { saga } from "./dependency.saga.ts";
import { schema } from "./dependency.schema.ts";

export const delivery = [Domain, aggregate, command, event, external, id, pure, saga, schema];
