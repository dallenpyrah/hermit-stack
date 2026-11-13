import { it } from "@effect/vitest";

import { readPage } from "./repository.build.ts";

it("reads the welcome page", () => readPage("welcome"));
