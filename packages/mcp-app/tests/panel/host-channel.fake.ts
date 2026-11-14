import { Array as Arr, Context, Effect, Layer, Match, Queue, Ref, Schema, Stream } from "effect";
import { McpClient } from "effect/ai";
import type { McpSchema } from "effect/ai";

import { HostChannel } from "#src/panel/host-channel.service.js";
import { RpcRequest } from "#src/protocol/message.schema.js";
import type { HostContext, IncomingMessage, OutgoingMessage, RpcNotification } from "#src/protocol/message.schema.js";
import { protocolVersion } from "#src/protocol/mcp-app.pure.js";

const ToolCall = Schema.Struct({ arguments: Schema.Record(Schema.String, Schema.Json), name: Schema.String });

type ToolCall = typeof ToolCall.Type;

interface FakeHostOptions {
  readonly context: HostContext;
  readonly opening: ToolCall;
  readonly prepare: readonly ToolCall[];
  readonly refuses: boolean;
}

class FakeHost extends Context.Service<
  FakeHost,
  {
    readonly changeContext: (context: HostContext) => Effect.Effect<void>;
    readonly sent: Effect.Effect<readonly OutgoingMessage[]>;
  }
>()("@repo/mcp-app/tests/panel/host-channel.fake/FakeHost") {}

type Offer = (message: IncomingMessage) => Effect.Effect<void>;

type Run = (call: ToolCall) => Effect.Effect<McpSchema.CallToolResult>;

const hostInfo = { name: "fake-host", version: "1.0.0" };

const methodNotFound = -32_601;

const notification = (method: string, params: RpcNotification["params"]): RpcNotification => ({
  jsonrpc: "2.0",
  method,
  params,
});

const runTool = Effect.fn("FakeHost.runTool")(function* runTool(call: ToolCall) {
  const client = yield* McpClient.McpClient;
  const tools = yield* client.listTools();
  const tool = yield* Effect.fromOption(Arr.findFirst(tools, ({ name }) => name === call.name));

  return yield* client.callTool({ arguments: call.arguments, tool });
}, Effect.orDie);

const initializeAnswer = (options: FakeHostOptions, request: RpcRequest): IncomingMessage =>
  Match.value(options.refuses).pipe(
    Match.when(true, () => ({
      error: { code: methodNotFound, message: "MCP Apps are not supported" },
      id: request.id,
      jsonrpc: "2.0" as const,
    })),
    Match.orElse(() => ({
      id: request.id,
      jsonrpc: "2.0" as const,
      result: { hostCapabilities: { serverTools: {} }, hostContext: options.context, hostInfo, protocolVersion },
    })),
  );

const opened = (options: FakeHostOptions, offer: Offer, run: Run): Effect.Effect<void> =>
  Effect.gen(function* openedCall() {
    yield* offer(notification("ui/notifications/tool-input", { arguments: options.opening.arguments }));

    const result = yield* run(options.opening);

    yield* offer(notification("ui/notifications/tool-result", result));
  });

const answerRequest =
  (options: FakeHostOptions, offer: Offer, run: Run) =>
  (request: RpcRequest): Effect.Effect<void> =>
    Match.value(request.method).pipe(
      Match.when("ui/initialize", () => offer(initializeAnswer(options, request))),
      Match.when("tools/call", () =>
        Schema.decodeUnknownEffect(ToolCall)(request.params).pipe(
          Effect.orDie,
          Effect.flatMap(run),
          Effect.flatMap((result) => offer({ id: request.id, jsonrpc: "2.0", result })),
        ),
      ),
      Match.orElse(() => Effect.void),
    );

const receive =
  (options: FakeHostOptions, offer: Offer, run: Run) =>
  (message: OutgoingMessage): Effect.Effect<void> =>
    Match.value(message).pipe(
      Match.when(Schema.is(RpcRequest), (request) => answerRequest(options, offer, run)(request)),
      Match.when({ method: "ui/notifications/initialized" }, () => opened(options, offer, run)),
      Match.orElse(() => Effect.void),
    );

const fakeHost = (options: FakeHostOptions): Layer.Layer<HostChannel | FakeHost, never, McpClient.McpClient> =>
  Layer.effectContext(
    Effect.gen(function* fakeHostLayer() {
      const client = yield* McpClient.McpClient;
      const toPanel = yield* Queue.unbounded<IncomingMessage>();
      const sent = yield* Ref.make<readonly OutgoingMessage[]>([]);
      const offer: Offer = (message) => Effect.asVoid(Queue.offer(toPanel, message));
      const run: Run = (call) => Effect.provideService(runTool(call), McpClient.McpClient, client);

      yield* Effect.forEach(options.prepare, run, { discard: true });

      const channel = HostChannel.of({
        incoming: Stream.fromQueue(toPanel),
        send: (message) => Effect.andThen(Ref.update(sent, Arr.append(message)), receive(options, offer, run)(message)),
      });

      const controls = FakeHost.of({
        changeContext: (context) => offer(notification("ui/notifications/host-context-changed", context)),
        sent: Ref.get(sent),
      });

      return Context.make(HostChannel, channel).pipe(Context.add(FakeHost, controls));
    }),
  );

const firstOf = <Value>(stream: Stream.Stream<Value>): Effect.Effect<Value> =>
  Effect.flatMap(Stream.runHead(stream), (head) => Effect.fromOption(head).pipe(Effect.orDie));

export { FakeHost, fakeHost, firstOf, hostInfo };

export type { FakeHostOptions };
