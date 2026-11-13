import { Context } from "effect";

export class One extends Context.Service<One, { readonly one: number }>()("One") {}

export class Two extends Context.Service<Two, { readonly two: number }>()("Two") {}
