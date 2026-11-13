import type { Toolable } from "@alchemy.run/domain/Ai";
import type { ClientOf, OnceCallName } from "@alchemy.run/domain/ReadRpcs";
import { Context } from "effect";
import type { Brand, Effect, Result, Stream } from "effect";
import type { RpcClientError } from "effect/rpc/RpcClientError";

import type { HostContext, Implementation } from "#src/protocol/message.schema.js";
import type { ToolCallError } from "#src/panel/tool-call.errors.js";

// A call of the Api a panel may make as a tool, named as the Api's client names it: a command's tag (`DepositMoney`)
// Or a read as `<View>.<operation>` (`Balance.get`).
type Call<Api extends Toolable> = OnceCallName<ClientOf<Api>>;

type ClientCall<Api extends Toolable, Name> = Name extends `${infer Namespace}.${infer Operation}`
  ? Namespace extends keyof ClientOf<Api>
    ? Operation extends keyof ClientOf<Api>[Namespace]
      ? ClientOf<Api>[Namespace][Operation]
      : never
    : never
  : Name extends keyof ClientOf<Api>
    ? ClientOf<Api>[Name]
    : never;

type WithoutHeaders<Options> = Omit<Exclude<Options, undefined>, "headers">;

// The tool's arguments, built the way Domain's toToolkit reads them: a command takes its target, input and command
// Id; a query its input and options; a read its key and options.
type ParamsOfCall<Fn> = Fn extends (key: infer Key, options?: infer Options) => Effect.Effect<unknown, unknown, unknown>
  ? Readonly<{ key: Key }> & WithoutHeaders<Options>
  : never;

// A command's client takes a target, its input and options with a command id; a query's takes its input and options.
type ParamsOfMethod<Fn> = Fn extends (...args: infer Args) => Effect.Effect<unknown, unknown, unknown>
  ? Args extends readonly [infer First, (infer Second)?, (infer Third)?]
    ? "commandId" extends keyof Exclude<Third, undefined>
      ? Readonly<{ commandId?: string; input: Exclude<Second, undefined>; target: First }>
      : Readonly<{ input: First }> & WithoutHeaders<Second>
    : never
  : never;

type Params<Api extends Toolable, Name> = Name extends `${string}.${string}`
  ? ParamsOfCall<ClientCall<Api, Name>>
  : ParamsOfMethod<ClientCall<Api, Name>>;

// Params as JSON carries them: a branded id is its plain string. The panel's own state holds plain values, and the
// Tool's schema checks them, brands included, before the call leaves the panel.
type Wire<Value> =
  Value extends Brand.Brand<string>
    ? Brand.Brand.Unbranded<Value>
    : Value extends readonly (infer Item)[]
      ? readonly Wire<Item>[]
      : Value extends object
        ? { readonly [Key in keyof Value]: Wire<Value[Key]> }
        : Value;

type Answer<Fn> = Fn extends (...args: never) => Effect.Effect<infer Value, unknown, unknown> ? Value : never;

// MCP requires a tool's structured result to be an object, so Domain returns any other value as { value }.
type ToolSuccess<Value> = [Value] extends [readonly unknown[]]
  ? Readonly<{ value: Value }>
  : [Value] extends [object]
    ? Value
    : Readonly<{ value: Value }>;

type Success<Api extends Toolable, Name> = ToolSuccess<Answer<ClientCall<Api, Name>>>;

// The rejections and middleware failures the call declares. The transport is the host here, not an RPC client.
type Failure<Api extends Toolable, Name> =
  ClientCall<Api, Name> extends (...args: never) => Effect.Effect<unknown, infer Error, unknown>
    ? Exclude<Error, RpcClientError>
    : never;

type ToolResult<Api extends Toolable, Name> = Result.Result<Success<Api, Name>, Failure<Api, Name> | ToolCallError>;

interface Size {
  readonly height: number;
  readonly width: number;
}

// What a panel's code uses to talk to its host, after the ui/initialize handshake. Every call is typed by the same
// Api the server derives its tools from, so renaming a command fails the panel's typecheck.
class PanelHost extends Context.Service<
  PanelHost,
  {
    // Calls a server tool through the host. A rejection comes back as the call's typed failure.
    readonly call: <Api extends Toolable, Name extends Call<Api>>(
      api: Api,
      name: Name,
      params: Wire<Params<Api, Name>>,
    ) => Effect.Effect<Success<Api, Name>, Failure<Api, Name> | ToolCallError>;
    // The host's context: what ui/initialize returned, then the same context after each change the host sends.
    readonly context: Stream.Stream<HostContext>;
    readonly hostInfo: Implementation;
    // Tells the host how much room the panel's content takes, so a flexible container can fit it.
    readonly reportSize: (size: Size) => Effect.Effect<void>;
    // The arguments of the tool call that opened the panel, decoded as the named call's params.
    readonly toolInput: <Api extends Toolable, Name extends Call<Api>>(
      api: Api,
      name: Name,
    ) => Stream.Stream<Result.Result<Params<Api, Name>, ToolCallError>>;
    // The result of that tool call, decoded as the named call's success or typed failure.
    readonly toolResult: <Api extends Toolable, Name extends Call<Api>>(
      api: Api,
      name: Name,
    ) => Stream.Stream<ToolResult<Api, Name>>;
  }
>()("@repo/mcp-app/panel/panel-host.service/PanelHost") {}

export { PanelHost };

export type { Call, Failure, Params, Size, Success, ToolResult, Wire };
