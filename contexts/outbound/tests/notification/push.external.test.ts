import { it } from "@effect/vitest";

import { PushFake } from "#tests/notification/push.fake";
import { pushContract } from "#tests/notification/push.suite";

it.layer(PushFake)("the in-memory push fake", pushContract);
