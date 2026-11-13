import { readPage } from "./repository.build.ts";

export const DocsNav = () => <nav>{readPage("welcome").length}</nav>;
