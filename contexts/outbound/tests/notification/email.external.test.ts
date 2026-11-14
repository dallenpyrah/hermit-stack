import { it } from "@effect/vitest";

import { EmailFake } from "#tests/notification/email.fake";
import { emailContract } from "#tests/notification/email.suite";

it.layer(EmailFake)("the in-memory email fake", emailContract);
