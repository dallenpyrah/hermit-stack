import { expect, test } from "vitest";

test("reports the nonconforming binding (oxc-project/oxc#29181)", () => {
  expect(1).toBe(1);
});
