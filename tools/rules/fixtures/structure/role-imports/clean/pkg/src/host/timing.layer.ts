import { Layer } from "effect";

import { timingLayer } from "./bench/timing.adapter.js";

export const hostLayer = Layer.mergeAll(timingLayer);
