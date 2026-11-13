import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";

import { Arm } from "#src/recurring/arm/arm.command.js";

const cron = "0 9 * * *";
const timeZone = "America/New_York";

const refusesUnreadableSettings = (): void => {
  expect(Option.isSome(Arm.makeOption({ cron, timeZone }))).toBe(true);
  expect(Option.isNone(Arm.makeOption({ cron: "every morning", timeZone }))).toBe(true);
  expect(Option.isNone(Arm.makeOption({ cron, timeZone: "Mars/Olympus" }))).toBe(true);
};

describe("arming a recurring schedule", () => {
  it.effect("is refused for a cron expression or time zone it cannot be read in", () =>
    Effect.sync(refusesUnreadableSettings),
  );
});
