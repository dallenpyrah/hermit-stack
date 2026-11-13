import { SwarmControlPlane, SwarmPool } from "@alchemy.run/rivet/Docker";
import { Layer } from "effect";

// A Rivet engine and one node on this machine's Docker swarm. Docker must be in swarm mode (`docker swarm init`);
// Cloud pools (GCP, AWS) are infra's to choose and replace this Layer one for one.
const controlPlane = SwarmControlPlane("Rivet");

const localSwarm = SwarmPool("Nodes").pipe(Layer.provide(controlPlane));

export { controlPlane, localSwarm };
