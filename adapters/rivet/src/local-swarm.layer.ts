import { SwarmControlPlane, SwarmPool } from "@alchemy.run/rivet/Docker";
import { Layer } from "effect";

const controlPlane = SwarmControlPlane("Rivet");

const localSwarm = SwarmPool("Nodes").pipe(Layer.provide(controlPlane));

export { controlPlane, localSwarm };
