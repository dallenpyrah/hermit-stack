import { Domain } from "@alchemy.run/domain";
import { command } from "./dependency.command.ts";
import { event } from "./dependency.event.ts";
import { id } from "./dependency.id.ts";
import { pure } from "./dependency.pure.ts";
import { rejection } from "./dependency.rejection.ts";
import { schema } from "./dependency.schema.ts";

export const delivery = [Domain, command, event, id, pure, rejection, schema];
