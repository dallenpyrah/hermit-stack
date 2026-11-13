import { Context, Effect, Layer } from "effect";

export class DocsStore extends Context.Service<DocsStore, { readonly read: Effect.Effect<string> }>()("test/DocsStore", {
  make: Effect.succeed({ read: Effect.succeed("") }),
}) {
  public static readonly layer = Layer.effect(this, this.make);
}
