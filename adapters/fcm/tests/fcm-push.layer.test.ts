import { it } from "@effect/vitest";
import { Layer } from "effect";

import { pushContract } from "@repo/outbound/push-contract";

import { FcmPush } from "#src/fcm-push.layer.js";
import { FcmApiFake } from "#tests/fcm-api.fake";

const fcm = FcmPush.pipe(Layer.provideMerge(FcmApiFake));

it.layer(fcm)("the FCM adapter against a local stand-in for Google's token endpoint and FCM's API", pushContract);
