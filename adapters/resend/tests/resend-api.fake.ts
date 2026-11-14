import { layerTest } from "@effect/platform-node/NodeHttpServer";
import {
  Array as Arr,
  ConfigProvider,
  Effect,
  Function as Fn,
  HashMap,
  HashSet,
  Layer,
  Option,
  Ref,
  Schema,
  String as Str,
} from "effect";
import { Hex } from "effect/encoding";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import type { Headers, HttpServerRequest } from "effect/http";

import { EmailVendor } from "@repo/outbound/email-fake";

const Send = Schema.Struct({
  from: Schema.String,
  subject: Schema.String,
  text: Schema.String,
  to: Schema.Union([Schema.String, Schema.Array(Schema.String)]),
});

type Send = typeof Send.Type;

interface Accepted {
  readonly body: string;
  readonly id: string;
}

interface Mailbox {
  readonly byKey: HashMap.HashMap<string, Accepted>;
  readonly delivered: readonly Send[];
  readonly silent: HashSet.HashSet<string>;
}

const keyBytes = 24;

const idBytes = 16;

const longestKey = 256;

const ok = 200;

const badRequest = 400;

const unauthorized = 401;

const forbidden = 403;

const conflict = 409;

const unprocessable = 422;

const malformedRecipient =
  "Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.";

const recipient = /^(?:[^<>]*<[^\s@<>]+@[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+)$/u;

type Refusal = HttpServerResponse.HttpServerResponse;

const refusal = (statusCode: number, name: string, message: string): Refusal =>
  HttpServerResponse.jsonUnsafe({ message, name, statusCode }, { status: statusCode });

const refuse = (statusCode: number, name: string, message: string): Effect.Effect<never, Refusal> =>
  Effect.fail(refusal(statusCode, name, message));

const isAddress = Schema.is(Schema.String);

const recipientsOf = (send: Send): readonly string[] => {
  if (isAddress(send.to)) {
    return [send.to];
  }

  return send.to;
};

const checkHeaders = Effect.fn("ResendApiFake.checkHeaders")(function* checkHeaders(
  headers: Headers.Headers,
  apiKey: string,
) {
  const { authorization = "", "idempotency-key": idempotencyKey, "user-agent": userAgent = "" } = headers;
  const key = Option.fromNullishOr(idempotencyKey);

  if (authorization !== `Bearer ${apiKey}`) {
    return yield* refuse(unauthorized, "validation_error", "API key is invalid");
  }

  if (Str.isEmpty(userAgent)) {
    return yield* refuse(forbidden, "validation_error", "The User-Agent header is required.");
  }

  if (Option.exists(key, (value) => Str.isEmpty(value) || value.length > longestKey)) {
    return yield* refuse(badRequest, "invalid_idempotency_key", "The key must be between 1-256 chars.");
  }

  return key;
});

const parse = (body: string): Effect.Effect<Send, Refusal> =>
  Effect.mapError(Schema.decodeEffect(Schema.fromJsonString(Send))(body), () =>
    refusal(unprocessable, "missing_required_field", "Missing `from`, `to`, `subject` or `text` field."),
  );

const replay = (state: Mailbox, key: Option.Option<string>, body: string): Effect.Effect<void, Refusal> =>
  Option.match(
    Option.flatMap(key, (value) => HashMap.get(state.byKey, value)),
    {
      onNone: () => Effect.void,
      onSome: (seen) => {
        if (seen.body !== body) {
          return refuse(conflict, "invalid_idempotent_request", "This key was used on a request with another payload.");
        }

        return Effect.fail(HttpServerResponse.jsonUnsafe({ id: seen.id }, { status: ok }));
      },
    },
  );

const checkRecipients = (state: Mailbox, send: Send): Effect.Effect<void, Refusal> => {
  const recipients = recipientsOf(send);

  if (!Arr.every(recipients, (address) => recipient.test(address))) {
    return refuse(unprocessable, "validation_error", malformedRecipient);
  }

  if (Arr.some(recipients, (address) => HashSet.has(state.silent, address))) {
    return Effect.never;
  }

  return Effect.void;
};

interface Acceptance {
  readonly body: string;
  readonly key: Option.Option<string>;
  readonly send: Send;
}

const accept = (mailbox: Ref.Ref<Mailbox>, { body, key, send }: Acceptance): Effect.Effect<string> =>
  Ref.modify(mailbox, (state) => {
    const id = Hex.encode(globalThis.crypto.getRandomValues(new Uint8Array(idBytes)));

    const byKey = Option.match(key, {
      onNone: () => state.byKey,
      onSome: (idempotencyKey) => HashMap.set(state.byKey, idempotencyKey, { body, id }),
    });

    return [id, { ...state, byKey, delivered: [...state.delivered, send] }];
  });

const handleSend = (
  mailbox: Ref.Ref<Mailbox>,
  apiKey: string,
): ((request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse>) =>
  Effect.fn("ResendApiFake.handleSend")(
    function* answerSend(request: HttpServerRequest.HttpServerRequest) {
      const key = yield* checkHeaders(request.headers, apiKey);
      const body = yield* Effect.orDie(request.text);
      const send = yield* parse(body);
      const state = yield* Ref.get(mailbox);

      yield* replay(state, key, body);
      yield* checkRecipients(state, send);

      const id = yield* accept(mailbox, { body, key, send });

      return HttpServerResponse.jsonUnsafe({ id }, { status: ok });
    },
    Effect.match({ onFailure: Fn.identity, onSuccess: Fn.identity }),
  );

const emptyMailbox: Mailbox = { byKey: HashMap.empty(), delivered: [], silent: HashSet.empty() };

const vendorOf = (mailbox: Ref.Ref<Mailbox>): EmailVendor["Service"] => ({
  deliveredTo: (address) =>
    Effect.map(Ref.get(mailbox), (state) =>
      Arr.map(
        Arr.filter(state.delivered, (send) => Arr.contains(recipientsOf(send), address)),
        (send) => ({ subject: send.subject, text: send.text }),
      ),
    ),
  stopAnsweringFor: (address) =>
    Ref.update(mailbox, (state) => ({ ...state, silent: HashSet.add(state.silent, address) })),
});

const ResendApiFake = Layer.unwrap(
  Effect.gen(function* resendApiFake() {
    const mailbox = yield* Ref.make(emptyMailbox);
    const apiKey = `re_${Hex.encode(globalThis.crypto.getRandomValues(new Uint8Array(keyBytes)))}`;
    const routes = HttpRouter.add("POST", "/emails", handleSend(mailbox, apiKey));
    const served = HttpRouter.serve(routes, { disableListenLog: true, disableLogger: true });

    const config = Layer.unwrap(
      HttpServer.addressFormattedWith((address) =>
        Effect.succeed(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({
              RESEND_API_KEY: apiKey,
              RESEND_BASE_URL: address,
              RESEND_FROM: "hermit-stack <notifications@hermit-stack.dev>",
              RESEND_TIMEOUT: "5 seconds",
            }),
          ),
        ),
      ),
    );

    return Layer.mergeAll(Layer.succeed(EmailVendor, vendorOf(mailbox)), config, served).pipe(
      Layer.provide(layerTest),
      Layer.orDie,
    );
  }),
);

export { ResendApiFake };
