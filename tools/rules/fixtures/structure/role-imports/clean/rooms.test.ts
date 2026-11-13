import { it } from "@effect/vitest";

import { FakeMailer } from "./mailer.fake.ts";
import { rooms } from "./rooms.service.ts";

it("runs", () => [FakeMailer, rooms]);
