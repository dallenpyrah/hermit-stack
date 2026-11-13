import { Layer } from "effect";

import { http } from "#src/http.layer.js";
import { mcp } from "#src/mcp.layer.js";

// Everything a client reaches, on one router: the JSON routes with their OpenAPI document, the typed client's /rpc
// And /mcp. Every target serves these routes; what differs is the process around them and the services under them:
// The host that runs the ledger's actors, and the HTTP platform the OpenAPI routes read files and ETags through.
const routes = Layer.mergeAll(http, mcp);

export { routes };
