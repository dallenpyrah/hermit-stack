import { layerDurableObjects } from "@alchemy.run/domain/Cloudflare";

// Every aggregate instance, view key and policy of a model becomes one Durable Object on the Worker that builds the
// Model's Layer, named after the model and the definition (`Ledger.AccountAggregate`, instance `a-1`). Those names
// Are where existing data lives, so renaming a model or an aggregate starts it empty on Cloudflare.
const durableObjects = layerDurableObjects();

export { durableObjects };
