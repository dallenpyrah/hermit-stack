import { it } from "@effect/vitest";
import { Layer } from "effect";

import { emailContract } from "@repo/outbound/email-contract";

import { ResendEmail } from "#src/resend-email.layer.js";
import { ResendApiFake } from "#tests/resend-api.fake";

const resend = ResendEmail.pipe(Layer.provideMerge(ResendApiFake));

it.layer(resend)("the Resend adapter against a local stand-in for Resend's API", emailContract);
