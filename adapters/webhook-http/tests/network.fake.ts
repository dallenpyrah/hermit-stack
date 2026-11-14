import { layerTest } from "@effect/platform-node/NodeHttpServer";
import { buildConnector } from "@effect/platform-node/Undici";
import {
  ConfigProvider,
  Context,
  Effect,
  Function as Fn,
  HashMap,
  Layer,
  Number as Num,
  Option,
  Redacted,
  Ref,
} from "effect";
import { Base64 } from "effect/encoding";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import type { HttpServerRequest } from "effect/http";

import { WebhookReceivers } from "@repo/outbound/webhook-transport-fake";

import { Network } from "#src/network.service.js";
import { SigningSecrets } from "#src/signing-secrets.service.js";

// The receiver's own address on this machine, host and port, which the operating system assigned.
class ReceiverServer extends Context.Service<ReceiverServer, { readonly address: string }>()(
  "@repo/webhook-http/tests/network.fake/ReceiverServer",
) {}

interface ReceivedRequest {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
}

interface ReceiverAnswer {
  readonly headers: Readonly<Record<string, string>>;
  readonly status: number;
}

interface Path {
  readonly answer: Option.Option<ReceiverAnswer>;
  readonly received: readonly ReceivedRequest[];
}

interface Receivers {
  readonly paths: HashMap.HashMap<string, Path>;
  readonly secrets: HashMap.HashMap<string, string>;
}

const publicHost = "hooks.receiver.example";

// A documentation address (RFC 5737), public by every test the transport applies and never routed anywhere.
const publicAddress = "203.0.113.10";

const secretBytes = 32;

const notFound = 404;

const ok: ReceiverAnswer = { headers: {}, status: 200 };

// The names this network resolves, as a hosts file would; every other name resolves to nothing.
const hosts = HashMap.make<readonly (readonly [string, readonly string[]])[]>(
  [publicHost, [publicAddress]],
  ["localhost", ["127.0.0.1", "::1"]],
);

const emptyReceivers: Receivers = { paths: HashMap.empty(), secrets: HashMap.empty() };

// The answer the path is set to give, or none when no receiver is open there.
type PathAnswer = Option.Option<Option.Option<ReceiverAnswer>>;

const record = (receivers: Ref.Ref<Receivers>, path: string, request: ReceivedRequest): Effect.Effect<PathAnswer> =>
  Ref.modify(receivers, (state) =>
    Option.match(HashMap.get(state.paths, path), {
      onNone: (): readonly [PathAnswer, Receivers] => [Option.none(), state],
      onSome: (found): readonly [PathAnswer, Receivers] => {
        const paths = HashMap.set(state.paths, path, { ...found, received: [...found.received, request] });

        return [Option.some(found.answer), { ...state, paths }];
      },
    }),
  );

// Records every request that reaches a receiver's path and answers as the case set it, or never.
const receive = (
  receivers: Ref.Ref<Receivers>,
): ((request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse>) =>
  Effect.fn("NetworkFake.receive")(function* receiveRequest(request: HttpServerRequest.HttpServerRequest) {
    const body = yield* Effect.orDie(request.text);
    const path = new globalThis.URL(request.url, "http://receiver").pathname;
    const answer = yield* record(receivers, path, { body, headers: request.headers, method: request.method });

    if (Option.isNone(answer)) {
      return HttpServerResponse.empty({ status: notFound });
    }

    if (Option.isNone(answer.value)) {
      return yield* Effect.never;
    }

    return HttpServerResponse.empty({ headers: answer.value.value.headers, status: answer.value.value.status });
  });

const receiversOf = (receivers: Ref.Ref<Receivers>): WebhookReceivers["Service"] => {
  const setPath = (path: string, update: (current: Path) => Path): Effect.Effect<void> =>
    Ref.update(receivers, (state) => ({ ...state, paths: HashMap.modify(state.paths, path, update) }));

  return {
    open: Ref.modify(receivers, (state) => {
      const path = `/hooks/${Num.increment(HashMap.size(state.paths))}`;
      const paths = HashMap.set(state.paths, path, { answer: Option.some(ok), received: [] });

      const receiver = {
        answerWith: (answer: ReceiverAnswer): Effect.Effect<void> =>
          setPath(path, (current) => ({ ...current, answer: Option.some(answer) })),
        received: Effect.map(Ref.get(receivers), (current) =>
          Option.match(HashMap.get(current.paths, path), {
            onNone: (): readonly ReceivedRequest[] => [],
            onSome: (found) => found.received,
          }),
        ),
        stopAnswering: setPath(path, (current) => ({ ...current, answer: Option.none() })),
        url: `http://${publicHost}${path}`,
        urlAt: (host: string): string => `http://${host}${path}`,
      };

      return [receiver, { ...state, paths }];
    }),
    secretOf: (endpointId) =>
      Ref.modify(receivers, (state) =>
        Option.match(HashMap.get(state.secrets, endpointId), {
          onNone: () => {
            const key = globalThis.crypto.getRandomValues(new Uint8Array(secretBytes));
            const secret = `whsec_${Base64.encode(key)}`;

            return [secret, { ...state, secrets: HashMap.set(state.secrets, endpointId, secret) }] as const;
          },
          onSome: (secret) => [secret, state] as const,
        }),
      ),
  };
};

// A network with one host on it: every address the transport dials leads to the local receiver, wherever it points,
// And names resolve from the hosts table above. Undici's own connector opens the connection.
const networkTo = (address: string): Network["Service"] => {
  const dial = buildConnector({});
  const { port } = new globalThis.URL(`http://${address}`);

  return {
    dial: (options, connected) => {
      dial({ ...options, hostname: "127.0.0.1", port, protocol: "http:" }, connected);
    },
    lookup: (hostname) => Effect.succeed(Option.getOrElse(HashMap.get(hosts, hostname), Fn.constant([]))),
  };
};

const shortTimeout = ConfigProvider.layer(ConfigProvider.fromUnknown({ WEBHOOK_HTTP_TIMEOUT: "2 seconds" }));

const aroundReceiver = (address: string): Layer.Layer<Network | ReceiverServer> => {
  const { host } = new globalThis.URL(address);

  return Layer.mergeAll(
    Layer.succeed(Network, networkTo(host)),
    Layer.succeed(ReceiverServer, { address: host }),
    shortTimeout,
  );
};

// Serves the receivers on a port the operating system assigns and provides what the transport and the contract need
// Around them: WebhookReceivers, the Network that leads to them, the endpoints' SigningSecrets, the receiver's own
// Address, and a short timeout in the Config the transport reads.
const NetworkFake = Layer.unwrap(
  Effect.gen(function* networkFake() {
    const receivers = yield* Ref.make(emptyReceivers);
    const world = receiversOf(receivers);
    const routes = HttpRouter.add("*", "/*", receive(receivers));
    const served = HttpRouter.serve(routes, { disableListenLog: true, disableLogger: true });

    const signing = Layer.succeed(SigningSecrets, {
      secretOf: (endpointId) => Effect.map(world.secretOf(endpointId), Redacted.make),
    });

    const around = Layer.unwrap(HttpServer.addressFormattedWith((address) => Effect.succeed(aroundReceiver(address))));

    return Layer.mergeAll(Layer.succeed(WebhookReceivers, world), signing, around, served).pipe(
      Layer.provide(layerTest),
      Layer.orDie,
    );
  }),
);

export { NetworkFake, ReceiverServer };
