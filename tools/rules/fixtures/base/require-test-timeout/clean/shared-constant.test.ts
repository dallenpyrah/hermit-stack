import { it } from "vitest";

const testTimeout = 15_000;

it("takes the shared timeout", { timeout: testTimeout }, () => {});

it("relies on the config timeout", () => {});
