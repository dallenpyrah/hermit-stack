import { expect, it } from "vitest";

it("weakens a true Boolean assertion", () => {
  const isReady = true;
  expect(isReady).toBeTruthy();
});
