import { Layer } from "effect";

import { http } from "#src/http.layer.js";
import { mcp } from "#src/mcp.layer.js";

const routes = Layer.mergeAll(http, mcp);

export { routes };
