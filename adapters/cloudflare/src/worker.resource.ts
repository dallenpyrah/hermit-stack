// The Effect runtime in a Worker reads a few Node APIs that workerd serves only with Node compatibility on.
const compatibility = { flags: ["nodejs_compat"] };

export { compatibility };

// Everything a Worker module imports is bundled into the Worker, so the entry reaches the Worker resource through this
// Module alone and leaves the deploy-time providers to the stack. Importing the package root instead pulls every
// Cloudflare provider into the bundle and makes each `alchemy dev` start about five times slower.
export { Worker } from "@alchemy.run/cloudflare/Workers/Worker";
