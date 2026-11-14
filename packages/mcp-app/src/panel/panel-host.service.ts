import type { Toolable } from "@alchemy.run/domain/Ai";
import type { ClientOf, OnceCallName } from "@alchemy.run/domain/ReadRpcs";
import { Context } from "effect";
import type { Brand, Effect, Result, Stream } from "effect";
import type { RpcClientError } from "effect/rpc/RpcClientError";

import type { HostContext, Implementation } from "#src/protocol/message.schema.js";
import type { ToolCallError } from "#src/panel/tool-call.errors.js";

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

type ParamsOfCall<Fn> = Fn extends (key: infer Key, options?: infer Options) => Effect.Effect<unknown, unknown, unknown>
  ? Readonly<{ key: Key }> & WithoutHeaders<Options>
  : never;

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

type Wire<Value> =
  Value extends Brand.Brand<string>
    ? Brand.Brand.Unbranded<Value>
    : Value extends readonly (infer Item)[]
      ? readonly Wire<Item>[]
      : Value extends object
        ? { readonly [Key in keyof Value]: Wire<Value[Key]> }
        : Value;

type Answer<Fn> = Fn extends (...args: never) => Effect.Effect<infer Value, unknown, unknown> ? Value : never;

type ToolSuccess<Value> = [Value] extends [readonly unknown[]]
  ? Readonly<{ value: Value }>
  : [Value] extends [object]
    ? Value
    : Readonly<{ value: Value }>;

type Success<Api extends Toolable, Name> = ToolSuccess<Answer<ClientCall<Api, Name>>>;

type Failure<Api extends Toolable, Name> =
  ClientCall<Api, Name> extends (...args: never) => Effect.Effect<unknown, infer Error, unknown>
    ? Exclude<Error, RpcClientError>
    : never;

type ToolResult<Api extends Toolable, Name> = Result.Result<Success<Api, Name>, Failure<Api, Name> | ToolCallError>;

interface Size {
  readonly height: number;
  readonly width: number;
}

class PanelHost extends Context.Service<
  PanelHost,
  {
    readonly call: <Api extends Toolable, Name extends Call<Api>>(
      api: Api,
      name: Name,
      params: Wire<Params<Api, Name>>,
    ) => Effect.Effect<Success<Api, Name>, Failure<Api, Name> | ToolCallError>;
    readonly context: Stream.Stream<HostContext>;
    readonly hostInfo: Implementation;
    readonly reportSize: (size: Size) => Effect.Effect<void>;
    readonly toolInput: <Api extends Toolable, Name extends Call<Api>>(
      api: Api,
      name: Name,
    ) => Stream.Stream<Result.Result<Params<Api, Name>, ToolCallError>>;
    readonly toolResult: <Api extends Toolable, Name extends Call<Api>>(
      api: Api,
      name: Name,
    ) => Stream.Stream<ToolResult<Api, Name>>;
  }
>()("@repo/mcp-app/panel/panel-host.service/PanelHost") {}

export { PanelHost };

export type { Call, Failure, Params, Size, Success, ToolResult, Wire };
