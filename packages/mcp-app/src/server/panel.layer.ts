import { toolName } from "@alchemy.run/domain/Ai";
import type { Exposable, Toolable } from "@alchemy.run/domain/Ai";
import { callName, operationsOf } from "@alchemy.run/domain/ReadRpcs";
import { Array as Arr, Context, Effect, HashMap, Layer, Option, Predicate, Record as Rec, pipe } from "effect";
import type { Cause } from "effect";
import { McpSchema, McpServer } from "effect/ai";

import { htmlMimeType, legacyResourceUriKey } from "#src/protocol/mcp-app.pure.js";

interface PanelCsp {
  readonly baseUriDomains?: readonly string[];
  readonly connectDomains?: readonly string[];
  readonly frameDomains?: readonly string[];
  readonly resourceDomains?: readonly string[];
}

interface PanelOptions<Api extends Toolable, Failure, Services> {
  readonly api: Api;
  readonly csp?: PanelCsp;
  readonly description?: string;
  readonly html: Effect.Effect<string, Failure, Services>;
  readonly name: string;
  readonly prefersBorder?: boolean;
  readonly renders: Arr.NonEmptyReadonlyArray<Exposable<Api>>;
  readonly uri: `ui://${string}`;
}

type PanelMeta = Readonly<{ ui: Readonly<Partial<Record<"csp" | "prefersBorder", PanelCsp | boolean>>> }>;

interface Panel<Failure, Services> {
  readonly description: string | undefined;
  readonly html: Effect.Effect<string, Failure, Services>;
  readonly meta: PanelMeta;
  readonly name: string;
  readonly tools: readonly string[];
  readonly unknownCalls: readonly string[];
  readonly uri: string;
}

type ToolMeta = McpSchema.Tool["_meta"];

type Server = McpServer.McpServer["Service"];

type ResourceRegistration = Server["addResource"] extends (registration: infer Registration) => Effect.Effect<void>
  ? Registration
  : never;

type ToolRegistration = Server["addTool"] extends (registration: infer Registration) => Effect.Effect<void>
  ? Registration
  : never;

const nonEmpty = (domains: readonly string[] | undefined): Option.Option<readonly string[]> =>
  pipe(Option.fromNullishOr(domains), Option.filter(Arr.isReadonlyArrayNonEmpty));

const cspOf = (csp: PanelCsp): Option.Option<PanelCsp> =>
  pipe(
    Rec.getSomes({
      baseUriDomains: nonEmpty(csp.baseUriDomains),
      connectDomains: nonEmpty(csp.connectDomains),
      frameDomains: nonEmpty(csp.frameDomains),
      resourceDomains: nonEmpty(csp.resourceDomains),
    }),
    Option.liftPredicate((domains) => !Rec.isEmptyRecord(domains)),
  );

const metaOf = (csp: PanelCsp, prefersBorder: boolean | undefined): PanelMeta => ({
  ui: Rec.getSomes<"csp" | "prefersBorder", PanelCsp | boolean>({
    csp: cspOf(csp),
    prefersBorder: Option.fromNullishOr(prefersBorder),
  }),
});

const panel = <Api extends Toolable, Failure, Services>(
  options: PanelOptions<Api, Failure, Services>,
): Panel<Failure, Services> => {
  const operations = operationsOf(options.api.serves);

  const resolved = Arr.map(options.renders, (call) => ({
    call,
    tool: pipe(
      Arr.findFirst(operations, (operation) => callName(operation) === call),
      Option.map((operation) =>
        toolName({ api: options.api.apiName, name: operation.name, operation: operation.operation }),
      ),
    ),
  }));

  return {
    description: options.description,
    html: options.html,
    meta: metaOf(options.csp ?? {}, options.prefersBorder),
    name: options.name,
    tools: Arr.getSomes(Arr.map(resolved, ({ tool }) => tool)),
    unknownCalls: Arr.map(
      Arr.filter(resolved, ({ tool }) => Option.isNone(tool)),
      ({ call }) => call,
    ),
    uri: options.uri,
  };
};

const withResourceUri = (meta: ToolMeta, uri: string): ToolMeta => {
  const ui = pipe(
    Option.fromNullishOr(meta),
    Option.flatMap(Rec.get("ui")),
    Option.filter(Predicate.isReadonlyObject),
    Option.getOrElse(() => ({})),
  );

  return { ...meta, [legacyResourceUriKey]: uri, ui: { ...ui, resourceUri: uri } };
};

const linked = (registration: ToolRegistration, uri: string): ToolRegistration => {
  const { _meta: meta, annotations, description, icons, inputSchema, name, outputSchema, title } = registration.tool;

  const tool = McpSchema.Tool.make({
    _meta: withResourceUri(meta, uri),
    annotations,
    description,
    icons,
    inputSchema,
    name,
    outputSchema,
    title,
  });

  return { ...registration, tool };
};

const readFailed =
  (uri: string) =>
  (cause: Cause.Cause<unknown>): Effect.Effect<never, McpSchema.InternalError> =>
    Effect.andThen(
      Effect.logError(`The panel ${uri} could not be read`, cause),
      Effect.fail(McpSchema.InternalError.make({ message: `The panel ${uri} could not be read.` })),
    );

const resourceOf = <Failure, Services>(
  declared: Panel<Failure, Services>,
  services: Context.Context<Services>,
): ResourceRegistration => {
  const contents = (text: string): McpSchema.ReadResourceResult => ({
    contents: [{ _meta: declared.meta, mimeType: htmlMimeType, text, uri: declared.uri }],
  });

  return {
    annotations: Context.empty(),
    handle: declared.html.pipe(
      Effect.provideContext(services),
      Effect.map(contents),
      Effect.catchCause(readFailed(declared.uri)),
    ),
    resource: McpSchema.Resource.make({
      _meta: declared.meta,
      description: declared.description,
      mimeType: htmlMimeType,
      name: declared.name,
      uri: declared.uri,
    }),
    services,
  };
};

const misdeclared = (
  unknownCalls: readonly string[],
  registered: Server["tools"],
  links: HashMap.HashMap<string, string>,
): Option.Option<string> => {
  const early = Arr.filter(registered, ({ tool }) => HashMap.has(links, tool.name));

  return Option.firstSomeOf([
    Option.liftPredicate(unknownCalls, Arr.isReadonlyArrayNonEmpty).pipe(
      Option.map((calls) => `No tool is derived for the panel calls ${Arr.join(calls, ", ")}.`),
    ),
    Option.liftPredicate(early, Arr.isReadonlyArrayNonEmpty).pipe(
      Option.map(
        (tools) =>
          `The tools ${Arr.join(
            Arr.map(tools, ({ tool }) => tool.name),
            ", ",
          )} registered before their panel. Provide the panels Layer to the tools.`,
      ),
    ),
  ]);
};

const panels = <Failure, Services>(
  declared: readonly Panel<Failure, Services>[],
): Layer.Layer<McpServer.McpServer, never, McpServer.McpServer | Services> =>
  Layer.effect(
    McpServer.McpServer,
    Effect.gen(function* panelsLayer() {
      const server = yield* McpServer.McpServer;
      const services = yield* Effect.context<Services>();

      const links = HashMap.fromIterable(
        Arr.flatMap(declared, (each) => Arr.map(each.tools, (tool) => [tool, each.uri] as const)),
      );

      const unknownCalls = Arr.flatMap(declared, (each) => each.unknownCalls);
      const problem = misdeclared(unknownCalls, server.tools, links);

      if (Option.isSome(problem)) {
        return yield* Effect.die(problem.value);
      }

      yield* Effect.forEach(declared, (each) => server.addResource(resourceOf(each, services)), { discard: true });

      const addTool = (registration: ToolRegistration): Effect.Effect<void> =>
        Option.match(HashMap.get(links, registration.tool.name), {
          onNone: () => server.addTool(registration),
          onSome: (uri) => server.addTool(linked(registration, uri)),
        });

      return McpServer.McpServer.of({ ...server, addTool });
    }),
  );

export { type Panel, type PanelCsp, type PanelOptions, panel, panels };
