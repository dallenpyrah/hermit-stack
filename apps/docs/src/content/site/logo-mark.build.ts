import { readRepositoryFile } from "#src/content/markdown/repository.build.ts";

const logoMark: string = readRepositoryFile("apps/docs/assets/favicon.svg").replace(
  "<svg ",
  '<svg class="hs-mark" width="22" height="22" aria-hidden="true" ',
);

export { logoMark };
