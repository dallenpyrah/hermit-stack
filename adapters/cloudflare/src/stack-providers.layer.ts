import { providers } from "@alchemy.run/cloudflare";
import { providers as domainProviders } from "@alchemy.run/domain/Cloudflare";
import { Layer } from "effect";

// What a stack with a Domain-hosting Worker registers: Cloudflare's resources, and the backfill a deploy waits on while
// New views receive their history. Under `alchemy dev` each runs its local provider, so no Cloudflare account is used.
const stackProviders = Layer.mergeAll(providers(), domainProviders());

export { stackProviders };
