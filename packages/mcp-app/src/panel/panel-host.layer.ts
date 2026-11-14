import { toToolkit } from "@alchemy.run/domain/Ai";
import type { Toolable } from "@alchemy.run/domain/Ai";
import {
  Array as Arr,
  Deferred,
  Duration,
  Effect,
  Exit,
  HashMap,
  Layer,
  Match,
  Number as Num,
  Option,
  Record as Rec,
  Ref,
  Result,
  Schema,
  Stream,
  SubscriptionRef,
} from "effect";
import type { Tool } from "effect/ai";

import { HostChannel } from "#src/panel/host-channel.service.js";
import { HostHandshakeError } from "#src/panel/host-handshake.errors.js";
import { PanelHost } from "#src/panel/panel-host.service.js";
import type { Call, Failure, Params, Size, Success, ToolResult, Wire } from "#src/panel/panel-host.service.js";
import { ToolCallError } from "#src/panel/tool-call.errors.js";
import {
  CallToolResult,
  ErrorResponse,
  HostContext,
  IncomingMessage,
  InitializeResult,
  RpcNotification,
  RpcRequest,
  SuccessResponse,
  TextContent,
  ToolCancelled,
  ToolInput,
} from "#src/protocol/message.schema.js";
import type { Implementation, RequestId } from "#src/protocol/message.schema.js";
import { protocolVersion } from "#src/protocol/mcp-app.pure.js";

class HostRequestError extends Schema.TaggedError<HostRequestError, { readonly brand: unique symbol }>()(
  "HostRequestError",
  { code: Schema.Int, message: Schema.String },
) {}

const handshakeSeconds = 10;

const methodNotFound = -32_601;

const firstRequestId = 0;

type Outcome = Result.Result<CallToolResult, string>;

type Arguments = (typeof ToolInput.Type)["arguments"];

type Reply = (typeof SuccessResponse.Type)["result"];

type RequestParams = RpcRequest["params"];

type Send = HostChannel["Service"]["send"];

interface Channel {
  readonly notify: (method: string, params: RequestParams) => Effect.Effect<void>;
  readonly request: (method: string, params: RequestParams) => Effect.Effect<Reply, HostRequestError>;
}

interface State {
  readonly context: SubscriptionRef.SubscriptionRef<HostContext>;
  readonly input: SubscriptionRef.SubscriptionRef<Option.Option<Arguments>>;
  readonly outcome: SubscriptionRef.SubscriptionRef<Option.Option<Outcome>>;
  readonly pending: Ref.Ref<HashMap.HashMap<RequestId, Deferred.Deferred<Reply, HostRequestError>>>;
}

interface NamedTool {
  readonly name: string;
  readonly tool: Tool.Any;
}

function codecAs<Value>(schema: Schema.Top): Schema.Codec<Value>;
function codecAs(schema: Schema.Top): Schema.Top {
  return schema;
}

const failedTool =
  (tool: string) =>
  (error: Readonly<{ message: string }>): ToolCallError =>
    ToolCallError.make({ message: error.message, tool });

const toolOf = <Api extends Toolable>(api: Api, call: Call<Api>): Effect.Effect<NamedTool, ToolCallError> => {
  const { tools } = toToolkit(api, { expose: [call] }).toolkit;
  const named = Arr.map(Rec.toEntries(tools), ([name, tool]) => ({ name, tool }));

  return Effect.mapError(Effect.fromOption(Arr.head(named)), () =>
    ToolCallError.make({ message: `${api.apiName} derives no tool for ${call}.`, tool: call }),
  );
};

const textOf = (result: CallToolResult): string =>
  Option.match(Arr.findFirst(result.content, Schema.is(TextContent)), {
    onNone: () => "The tool failed without saying why.",
    onSome: (content) => content.text,
  });

const rejectionOf = <Rejection>(
  { name, tool }: NamedTool,
  result: CallToolResult,
): Effect.Effect<never, Rejection | ToolCallError> => {
  const text = textOf(result);
  const decoded = Schema.decodeEffect(Schema.fromJsonString(codecAs<Rejection>(tool.failureSchema)))(text);

  return decoded.pipe(
    Effect.mapError(() => ToolCallError.make({ message: text, tool: name })),
    Effect.flatMap(Effect.fail),
  );
};

const answerOf = <Answer, Rejection>(
  named: NamedTool,
  result: CallToolResult,
): Effect.Effect<Answer, Rejection | ToolCallError> =>
  Match.value(result.isError).pipe(
    Match.when(true, () => rejectionOf<Rejection>(named, result)),
    Match.orElse(() =>
      Schema.decodeUnknownEffect(codecAs<Answer>(named.tool.successSchema))(result.structuredContent).pipe(
        Effect.mapError(failedTool(named.name)),
      ),
    ),
  );

const outcomeAnswer = <Answer, Rejection>(
  named: NamedTool,
  outcome: Outcome,
): Effect.Effect<Answer, Rejection | ToolCallError> =>
  Result.match(outcome, {
    onFailure: (reason) => Effect.fail(ToolCallError.make({ message: `Cancelled: ${reason}`, tool: named.name })),
    onSuccess: (result) => answerOf<Answer, Rejection>(named, result),
  });

const presentOnly = <Value>(ref: SubscriptionRef.SubscriptionRef<Option.Option<Value>>): Stream.Stream<Value> =>
  SubscriptionRef.changes(ref).pipe(
    Stream.filter(Option.isSome),
    Stream.map((present) => present.value),
  );

const settle = (state: State, id: RequestId, exit: Exit.Exit<Reply, HostRequestError>): Effect.Effect<void> =>
  Ref.modify(state.pending, (pending) => [HashMap.get(pending, id), HashMap.remove(pending, id)] as const).pipe(
    Effect.flatMap(
      Option.match({ onNone: () => Effect.void, onSome: (deferred) => Effect.asVoid(Deferred.done(deferred, exit)) }),
    ),
  );

const answerHost = (send: Send, request: RpcRequest): Effect.Effect<void> =>
  Match.value(request.method).pipe(
    Match.whenOr("ping", "ui/resource-teardown", () => send({ id: request.id, jsonrpc: "2.0", result: {} })),
    Match.orElse((method) =>
      send({ error: { code: methodNotFound, message: `${method} is not supported` }, id: request.id, jsonrpc: "2.0" }),
    ),
  );

const updateDecoded =
  <Fields, Value>(schema: Schema.Codec<Fields>, ref: SubscriptionRef.SubscriptionRef<Value>) =>
  (notification: RpcNotification, toValue: (fields: Fields, current: Value) => Value): Effect.Effect<void> =>
    Option.match(Schema.decodeUnknownOption(schema)(notification.params), {
      onNone: () => Effect.logWarning(`The host sent a ${notification.method} that does not match the specification`),
      onSome: (fields) => SubscriptionRef.update(ref, (current) => toValue(fields, current)),
    });

const noticeOf = (state: State, notification: RpcNotification): Effect.Effect<void> =>
  Match.value(notification.method).pipe(
    Match.when("ui/notifications/tool-input", () =>
      updateDecoded(ToolInput, state.input)(notification, (fields) => Option.some(fields.arguments)),
    ),
    Match.when("ui/notifications/tool-result", () =>
      updateDecoded(CallToolResult, state.outcome)(notification, (fields) => Option.some(Result.succeed(fields))),
    ),
    Match.when("ui/notifications/tool-cancelled", () =>
      updateDecoded(ToolCancelled, state.outcome)(notification, (fields) =>
        Option.some(Result.fail(fields.reason ?? "no reason given")),
      ),
    ),
    Match.when("ui/notifications/host-context-changed", () =>
      updateDecoded(HostContext, state.context)(notification, (fields, current) => ({ ...current, ...fields })),
    ),
    Match.orElse(() => Effect.void),
  );

const route =
  (state: State, send: Send) =>
  (message: IncomingMessage): Effect.Effect<void> =>
    Match.value(message).pipe(
      Match.when(Schema.is(ErrorResponse), (response) =>
        settle(state, response.id, Exit.fail(HostRequestError.make(response.error))),
      ),
      Match.when(Schema.is(SuccessResponse), (response) => settle(state, response.id, Exit.succeed(response.result))),
      Match.when(Schema.is(RpcRequest), (request) => answerHost(send, request)),
      Match.when(Schema.is(RpcNotification), (notification) => noticeOf(state, notification)),
      Match.orElse(() => Effect.void),
    );

const listen = (state: State, { incoming, send }: HostChannel["Service"]): Effect.Effect<void> =>
  incoming.pipe(
    Stream.map((message) => Schema.decodeUnknownOption(IncomingMessage)(message)),
    Stream.filter(Option.isSome),
    Stream.runForEach((decoded) => route(state, send)(decoded.value)),
  );

const channelOf = (state: State, send: Send, ids: Ref.Ref<number>): Channel => ({
  notify: (method, params) => send({ jsonrpc: "2.0", method, params }),
  request: (method, params) =>
    Effect.gen(function* request() {
      const id = yield* Ref.updateAndGet(ids, Num.increment);
      const answer = yield* Deferred.make<Reply, HostRequestError>();

      yield* Ref.update(state.pending, (pending) => HashMap.set(pending, id, answer));
      yield* send({ id, jsonrpc: "2.0", method, params });

      return yield* Deferred.await(answer);
    }),
});

const handshake = Effect.fn("PanelHost.handshake")(function* handshake(channel: Channel, appInfo: Implementation) {
  const initialize = channel.request("ui/initialize", {
    appCapabilities: { availableDisplayModes: ["inline"] },
    appInfo,
    protocolVersion,
  });

  const answer = yield* initialize.pipe(
    Effect.timeoutOrElse({
      duration: Duration.seconds(handshakeSeconds),
      orElse: () => Effect.fail(HostHandshakeError.make({ message: "The host did not answer ui/initialize." })),
    }),
    Effect.mapError((error) => HostHandshakeError.make({ message: error.message })),
  );

  return yield* Schema.decodeUnknownEffect(InitializeResult)(answer).pipe(
    Effect.mapError((error) => HostHandshakeError.make({ message: `The host's initialize result: ${error.message}` })),
  );
});

const callOf =
  (channel: Channel) =>
  <Api extends Toolable, Name extends Call<Api>>(
    api: Api,
    name: Name,
    params: Wire<Params<Api, Name>>,
  ): Effect.Effect<Success<Api, Name>, Failure<Api, Name> | ToolCallError> =>
    Effect.gen(function* call() {
      const named = yield* toolOf(api, name);
      const failed = failedTool(named.name);
      const codec = codecAs<Params<Api, Name>>(named.tool.parametersSchema);
      const checked = yield* Effect.mapError(Schema.decodeUnknownEffect(codec)(params), failed);
      const encoded = yield* Effect.mapError(Schema.encodeEffect(codec)(checked), failed);
      const request = channel.request("tools/call", { arguments: encoded, name: named.name });
      const answer = yield* Effect.mapError(request, failed);
      const result = yield* Effect.mapError(Schema.decodeUnknownEffect(CallToolResult)(answer), failed);

      return yield* answerOf<Success<Api, Name>, Failure<Api, Name>>(named, result);
    });

const toolInputOf =
  (state: State) =>
  <Api extends Toolable, Name extends Call<Api>>(
    api: Api,
    name: Name,
  ): Stream.Stream<Result.Result<Params<Api, Name>, ToolCallError>> =>
    Stream.mapEffect(presentOnly(state.input), (args) =>
      toolOf(api, name).pipe(
        Effect.flatMap((named) =>
          Effect.mapError(
            Schema.decodeUnknownEffect(codecAs<Params<Api, Name>>(named.tool.parametersSchema))(args),
            failedTool(named.name),
          ),
        ),
        Effect.result,
      ),
    );

const toolResultOf =
  (state: State) =>
  <Api extends Toolable, Name extends Call<Api>>(api: Api, name: Name): Stream.Stream<ToolResult<Api, Name>> =>
    Stream.mapEffect(presentOnly(state.outcome), (outcome) =>
      toolOf(api, name).pipe(
        Effect.flatMap((named) => outcomeAnswer<Success<Api, Name>, Failure<Api, Name>>(named, outcome)),
        Effect.result,
      ),
    );

const serviceOf = (state: State, channel: Channel, hostInfo: Implementation): PanelHost["Service"] =>
  PanelHost.of({
    call: callOf(channel),
    context: SubscriptionRef.changes(state.context),
    hostInfo,
    reportSize: (size: Size) => channel.notify("ui/notifications/size-changed", size),
    toolInput: toolInputOf(state),
    toolResult: toolResultOf(state),
  });

const panelHost = (appInfo: Implementation): Layer.Layer<PanelHost, HostHandshakeError, HostChannel> =>
  Layer.effect(
    PanelHost,
    Effect.gen(function* panelHostLayer() {
      const host = yield* HostChannel;

      const state: State = {
        context: yield* SubscriptionRef.make<HostContext>({}),
        input: yield* SubscriptionRef.make(Option.none<Arguments>()),
        outcome: yield* SubscriptionRef.make(Option.none<Outcome>()),
        pending: yield* Ref.make(HashMap.empty<RequestId, Deferred.Deferred<Reply, HostRequestError>>()),
      };

      const ids = yield* Ref.make(firstRequestId);
      const channel = channelOf(state, host.send, ids);

      yield* Effect.forkScoped(listen(state, host));

      const initialized = yield* handshake(channel, appInfo);

      yield* SubscriptionRef.set(state.context, initialized.hostContext ?? {});
      yield* channel.notify("ui/notifications/initialized", {});

      return serviceOf(state, channel, initialized.hostInfo);
    }),
  );

export { panelHost };
