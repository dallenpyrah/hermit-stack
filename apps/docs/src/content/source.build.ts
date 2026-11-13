import { loader } from "fumadocs-core/source";

import { docs } from "#source/server.ts";

const source = loader({ baseUrl: "/docs", source: docs.toFumadocsSource() });

export { source };
