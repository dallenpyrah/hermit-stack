import { Context, Effect } from "effect";

export class Rooms extends Context.Service<Rooms, { readonly count: Effect.Effect<number> }>()("app/Rooms") {}
