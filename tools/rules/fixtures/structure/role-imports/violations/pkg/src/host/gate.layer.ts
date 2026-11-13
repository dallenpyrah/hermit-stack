import { Layer } from "effect";

import { gateLayer } from "../../bench/archil-gate.adapter.mjs";

export const hostLayer = Layer.mergeAll(gateLayer);
