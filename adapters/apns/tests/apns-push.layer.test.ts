import { it } from "@effect/vitest";
import { Layer } from "effect";

import { pushContract } from "@repo/outbound/push-contract";

import { ApnsPush } from "#src/apns-push.layer.js";
import { ApnsApiFake } from "#tests/apns-api.fake";

const apns = ApnsPush.pipe(Layer.provideMerge(ApnsApiFake));

it.layer(apns)("the APNs adapter against a local HTTP/2 stand-in for APNs", pushContract);
