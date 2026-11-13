import { readRepositoryFile } from "#src/content/markdown/repository.build.ts";

export const dynamic = "force-static";

export const GET = (): Response =>
  new Response(readRepositoryFile("apps/docs/assets/favicon.svg"), {
    headers: { "Content-Type": "image/svg+xml" },
  });
