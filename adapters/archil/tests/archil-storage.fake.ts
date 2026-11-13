import { layerTest } from "@effect/platform-node/NodeHttpServer";
import { layer as nodeServices } from "@effect/platform-node/NodeServices";
import type { Disks, Sandboxes } from "@repo/storage";
import { Effect, FileSystem, Layer, Redacted } from "effect";
import type { PlatformError } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import type { HttpServerError } from "effect/http";
import type { ChildProcessSpawner } from "effect/process";

import { ArchilStorage } from "#src/archil-storage.layer.js";
import { ArchilDisksStandIn } from "#tests/disk/archil-disks.fake";
import { ArchilSandboxesStandIn } from "#tests/sandbox/archil-sandboxes.fake";

// Both halves of the stand-in on one router, answering on a port the operating system picks.
const servedFrom = (
  root: string,
): Layer.Layer<HttpServer.HttpServer, HttpServerError.ServeError, ChildProcessSpawner.ChildProcessSpawner> => {
  const routes = Layer.mergeAll(ArchilDisksStandIn(root), ArchilSandboxesStandIn(root));
  const served = HttpRouter.serve(routes, { disableListenLog: true, disableLogger: true });

  return Layer.provideMerge(served, layerTest);
};

// The adapter pointed at the stand-in: its control plane and, since the URL is not an Archil one, its data plane too.
const adapter = Layer.unwrap(
  HttpServer.addressFormattedWith((url) =>
    Effect.succeed(ArchilStorage({ apiBaseUrl: url, apiKey: Redacted.make("stand-in"), diskPrefix: "contract" })),
  ),
);

// Both storage ports on the Archil adapter, talking HTTP and WebSocket to a local stand-in for Archil that keeps its
// Disks in a temporary folder, deleted with the layer. Nothing reaches Archil itself.
const ArchilStandIn: Layer.Layer<Disks | Sandboxes, HttpServerError.ServeError | PlatformError.PlatformError> =
  Layer.unwrap(
    Effect.gen(function* archilStandIn() {
      const files = yield* FileSystem.FileSystem;
      const root = yield* files.makeTempDirectoryScoped({ prefix: "archil-stand-in-" });

      return Layer.provide(adapter, servedFrom(root));
    }),
  ).pipe(Layer.provide(nodeServices));

export { ArchilStandIn };
