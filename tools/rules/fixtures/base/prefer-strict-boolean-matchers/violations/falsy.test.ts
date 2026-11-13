import { expect, it } from "vitest";

it("weakens a false Boolean assertion", () => {
  const isClosed = false;
  expect(isClosed).toBeFalsy();
});
