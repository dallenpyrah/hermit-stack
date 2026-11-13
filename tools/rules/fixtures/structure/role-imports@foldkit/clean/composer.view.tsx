import { command } from "./dependency.command.ts";
import { message } from "./dependency.message.ts";
import { model } from "./dependency.model.ts";
import { subscription } from "./dependency.subscription.ts";
import { update } from "./dependency.update.ts";

export const composer = [command, message, model, subscription, update];
