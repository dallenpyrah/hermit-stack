import { Schema } from "effect";

// The MCP Apps messages a panel reads, as the specification shapes them. Each Struct drops the fields it does not name,
// So a host that sends more than the specification requires still decodes.

const RequestId = Schema.Union([Schema.String, Schema.Int]);

type RequestId = typeof RequestId.Type;

const jsonRpc = Schema.Literal("2.0");

const RpcError = Schema.Struct({ code: Schema.Int, message: Schema.String });

const ErrorResponse = Schema.Struct({ error: RpcError, id: RequestId, jsonrpc: jsonRpc });

const SuccessResponse = Schema.Struct({ id: RequestId, jsonrpc: jsonRpc, result: Schema.Unknown });

const RpcRequest = Schema.Struct({
  id: RequestId,
  jsonrpc: jsonRpc,
  method: Schema.String,
  params: Schema.optionalKey(Schema.Unknown),
});

type RpcRequest = typeof RpcRequest.Type;

const RpcNotification = Schema.Struct({
  jsonrpc: jsonRpc,
  method: Schema.String,
  params: Schema.optionalKey(Schema.Unknown),
});

type RpcNotification = typeof RpcNotification.Type;

// Everything a host sends, decoded in this order: an answer before a request, and a request before a notification, since
// The notification schema would also accept a request and drop its id.
const IncomingMessage = Schema.Union([ErrorResponse, SuccessResponse, RpcRequest, RpcNotification]);

type IncomingMessage = typeof IncomingMessage.Type;

// Everything a panel sends: requests and notifications of its own, and answers to the host's requests.
const OutgoingMessage = Schema.Union([RpcRequest, RpcNotification, SuccessResponse, ErrorResponse]);

type OutgoingMessage = typeof OutgoingMessage.Type;

const Theme = Schema.Literals(["light", "dark"]);

type Theme = typeof Theme.Type;

// Each side is either fixed (height, width), so the panel fills it, or flexible up to a maximum, so the panel reports
// Its own size; a side with neither is unbounded.
const ContainerDimensions = Schema.Struct({
  height: Schema.optionalKey(Schema.Finite),
  maxHeight: Schema.optionalKey(Schema.Finite),
  maxWidth: Schema.optionalKey(Schema.Finite),
  width: Schema.optionalKey(Schema.Finite),
});

type ContainerDimensions = typeof ContainerDimensions.Type;

// The host's style variables and fonts are left out on purpose: a hermit-stack panel paints with its own design tokens
// And follows only the host's light or dark choice.
const HostContext = Schema.Struct({
  containerDimensions: Schema.optionalKey(ContainerDimensions),
  displayMode: Schema.optionalKey(Schema.Literals(["inline", "fullscreen", "pip"])),
  locale: Schema.optionalKey(Schema.String),
  theme: Schema.optionalKey(Theme),
  timeZone: Schema.optionalKey(Schema.String),
});

type HostContext = typeof HostContext.Type;

const Implementation = Schema.Struct({ name: Schema.String, version: Schema.String });

type Implementation = typeof Implementation.Type;

const InitializeResult = Schema.Struct({
  hostContext: Schema.optionalKey(HostContext),
  hostInfo: Implementation,
  protocolVersion: Schema.String,
});

const ToolInput = Schema.Struct({ arguments: Schema.Record(Schema.String, Schema.Unknown) });

const ToolCancelled = Schema.Struct({ reason: Schema.optionalKey(Schema.String) });

// The standard MCP CallToolResult: text for the model, structuredContent for the panel, isError for a failed call.
const CallToolResult = Schema.Struct({
  content: Schema.Array(Schema.Unknown),
  isError: Schema.optionalKey(Schema.Boolean),
  structuredContent: Schema.optionalKey(Schema.Unknown),
});

type CallToolResult = typeof CallToolResult.Type;

const TextContent = Schema.Struct({ text: Schema.String, type: Schema.Literal("text") });

export {
  CallToolResult,
  ContainerDimensions,
  ErrorResponse,
  HostContext,
  Implementation,
  IncomingMessage,
  InitializeResult,
  OutgoingMessage,
  RequestId,
  RpcNotification,
  RpcRequest,
  SuccessResponse,
  TextContent,
  Theme,
  ToolCancelled,
  ToolInput,
};
