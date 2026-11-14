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

const servedFrom = (
  root: string,
): Layer.Layer<HttpServer.HttpServer, HttpServerError.ServeError, ChildProcessSpawner.ChildProcessSpawner> => {
  const routes = Layer.mergeAll(ArchilDisksStandIn(root), ArchilSandboxesStandIn(root));
  const served = HttpRouter.serve(routes, { disableListenLog: true, disableLogger: true });

  return Layer.provideMerge(served, layerTest);
};

const adapter = Layer.unwrap(
  HttpServer.addressFormattedWith((url) =>
    Effect.succeed(ArchilStorage({ apiBaseUrl: url, apiKey: Redacted.make("stand-in"), diskPrefix: "contract" })),
  ),
);

const ArchilStandIn: Layer.Layer<Disks | Sandboxes, HttpServerError.ServeError | PlatformError.PlatformError> =
  Layer.unwrap(
    Effect.gen(function* archilStandIn() {
      const files = yield* FileSystem.FileSystem;
      const root = yield* files.makeTempDirectoryScoped({ prefix: "archil-stand-in-" });

      return Layer.provide(adapter, servedFrom(root));
    }),
  ).pipe(Layer.provide(nodeServices));

export { ArchilStandIn };
