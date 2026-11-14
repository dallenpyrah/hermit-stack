import { makeHandler, makeUpgradeHandler } from "@effect/platform-node/NodeHttpServer";
import { Deferred, Effect, Exit, Scope } from "effect";
import { HttpRouter } from "effect/http";
import { isRunnableDevEnvironment } from "vite";
import type { Plugin, ViteDevServer } from "vite";
import { WebSocketServer } from "ws";

import type { devOrigin } from "#src/server/local-origin.layer.js";

type LocalOrigin = Readonly<{ devOrigin: typeof devOrigin }>;

const localOriginModule = "/src/server/local-origin.layer.ts";

const ledgerPath = /^\/rpc\/?(?:\?|$)/u;

const isLedger = (url: string | undefined): boolean => ledgerPath.test(url ?? "");

const handlersFor = Effect.fn("handlersFor")(function* handlersForEffect(origin: LocalOrigin) {
  const scope = yield* Effect.scope;
  const app = yield* HttpRouter.toHttpEffect(origin.devOrigin);
  const onRequest = yield* makeHandler(app, { scope });
  const sockets = Effect.sync(() => new WebSocketServer({ noServer: true }));
  const onUpgrade = yield* makeUpgradeHandler(sockets, app, { scope });

  return { onRequest, onUpgrade };
});

type Handlers = Effect.Success<ReturnType<typeof handlersFor>>;

type UpgradeArguments = Parameters<Handlers["onUpgrade"]>;

const loadOrigin = Effect.fn("loadOrigin")(function* loadOriginEffect(server: ViteDevServer) {
  const environment = server.environments.ssr;

  if (!isRunnableDevEnvironment(environment)) {
    return yield* Effect.die("The SSR environment cannot run modules, so the ledger cannot load");
  }

  return yield* Effect.promise(() => environment.runner.import<LocalOrigin>(localOriginModule));
});

const startLedger = (server: ViteDevServer, scope: Scope.Scope): Effect.Effect<Handlers> =>
  Effect.flatMap(loadOrigin(server), handlersFor).pipe(Scope.provide(scope));

const mount = Effect.fn("mount")(function* mountEffect(server: ViteDevServer) {
  const scope = Scope.makeUnsafe();
  const services = yield* Effect.context();
  const run = Effect.runForkWith(services);
  const ready = yield* Deferred.make<Handlers>();

  const whenReady = (use: (handlers: Handlers) => void): void => {
    run(Effect.map(Deferred.await(ready), use));
  };

  server.middlewares.use((request, response, next) => {
    if (isLedger(request.url)) {
      whenReady(({ onRequest }) => {
        onRequest(request, response);
      });

      return;
    }

    next();
  });

  server.httpServer?.on("upgrade", (...upgrade: UpgradeArguments) => {
    const [request] = upgrade;

    if (isLedger(request.url)) {
      whenReady(({ onUpgrade }) => {
        onUpgrade(...upgrade);
      });
    }
  });

  server.httpServer?.once("listening", () => {
    run(Effect.flatMap(startLedger(server, scope), (handlers) => Deferred.succeed(ready, handlers)));
  });

  server.httpServer?.once("close", () => {
    run(Scope.close(scope, Exit.void));
  });
});

const ledgerApi = (): Plugin => ({
  apply: "serve",
  configureServer: (server) => Effect.runPromise(mount(server)),
  name: "hermit-stack:ledger-api",
});

export { ledgerApi };
