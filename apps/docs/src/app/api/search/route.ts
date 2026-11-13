import { createFromSource } from "fumadocs-core/search/server";

import { source } from "#src/content/source.build.ts";

// A static export has no server, so the build writes the search index to /api/search once.
export const dynamic = "force-static";

export const { staticGET: GET } = createFromSource(source, { language: "english" });
