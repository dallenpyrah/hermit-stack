import { providers } from "@alchemy.run/cloudflare";
import { providers as domainProviders } from "@alchemy.run/domain/Cloudflare";
import { Layer } from "effect";

const stackProviders = Layer.mergeAll(providers(), domainProviders());

export { stackProviders };
