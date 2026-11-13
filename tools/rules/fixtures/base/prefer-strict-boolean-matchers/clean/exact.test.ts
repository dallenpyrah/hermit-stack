import { expect, it } from "vitest";

it("checks exact Boolean values", () => {
  const isReady = true;
  const isClosed = false;
  expect(isReady).toBe(true);
  expect(isClosed).toBe(false);
  expect(isReady).not.toBe(false);
  expect(isClosed).not.toBe(true);
});
