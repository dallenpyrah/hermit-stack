import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

class AccountOpened extends Event("AccountOpened", { owner: Schema.NonEmptyString }) {}

export { AccountOpened };
