import { Domain } from "@alchemy.run/domain";
import { command } from "./dependency.command.ts";
import { context } from "./dependency.context.ts";
import { middleware } from "./dependency.middleware.ts";
import { model } from "./dependency.model.ts";
import { query } from "./dependency.query.ts";
import { stream } from "./dependency.stream.ts";
import { view } from "./dependency.view.ts";

export const delivery = [Domain, command, context, middleware, model, query, stream, view];
