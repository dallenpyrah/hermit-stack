import { it } from "@effect/vitest";

import { sessionContract, sessionTarget } from "#src/session.suite.js";
import { SessionFake } from "#tests/session.fake";

it.layer(sessionTarget(SessionFake))("the Session port, adapted by the in-memory fake", sessionContract);
