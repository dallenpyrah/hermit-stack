import { layerTest } from "@effect/platform-node/NodeHttpServer";
import { Array as Arr, Effect, Layer, Option, Redacted, Ref, String as Str } from "effect";
import type { Scope } from "effect";
import { Headers, HttpRouter, HttpServer, HttpServerResponse, UrlParams } from "effect/http";
import type { HttpServerRequest } from "effect/http";

// What the stand-in Stripe account sells and holds.
interface Account {
  readonly customers: readonly string[];
  readonly prices: readonly string[];
  readonly subscriptions: readonly string[];
}

// One request the stand-in received: its method, path and form body as Stripe would parse it.
interface Received {
  readonly form: UrlParams.UrlParams;
  readonly method: string;
  readonly path: string;
}

interface StripeStandIn {
  readonly baseUrl: string;
  readonly received: Effect.Effect<readonly Received[]>;
}

// The fields of a Stripe object or error the adapter reads.
interface StripeObject {
  readonly [field: string]: boolean | string | StripeObject;
}

interface Answer {
  readonly body: StripeObject;
  readonly status: number;
}

// The key the adapter under test is given. It is not a Stripe key, so no real account can be reached with it.
const standInKey = Redacted.make("stand-in-key");

const okStatus = 200;

const missingParameterStatus = 400;

const unauthorizedStatus = 401;

const missingPathStatus = 404;

// Stripe's error envelope for a reference it does not hold.
const missing = (status: number, what: string): Answer => ({
  body: { error: { code: "resource_missing", message: `No such ${what}`, type: "invalid_request_error" } },
  status,
});

const ok = (body: StripeObject): Answer => ({ body, status: okStatus });

const unauthorized: Answer = {
  body: { error: { message: "Invalid API Key provided", type: "invalid_request_error" } },
  status: unauthorizedStatus,
};

const subscriptionPath = /^\/v1\/subscriptions\/(?<id>[^/]+)$/u;

const formField = (request: Received, key: string): string =>
  Option.getOrElse(UrlParams.getFirst(request.form, key), () => "");

const checkout = (account: Account, request: Received): Answer => {
  const price = formField(request, "line_items[0][price]");

  if (!Arr.contains(account.prices, price)) {
    return missing(missingParameterStatus, `price: '${price}'`);
  }

  return ok({ id: "cs_stand_in", object: "checkout.session", url: "https://checkout.stripe.com/c/pay/cs_stand_in" });
};

const portal = (account: Account, request: Received): Answer => {
  const customer = formField(request, "customer");

  if (!Arr.contains(account.customers, customer)) {
    return missing(missingParameterStatus, `customer: '${customer}'`);
  }

  return ok({ id: "bps_stand_in", object: "billing_portal.session", url: "https://billing.stripe.com/p/session/bps" });
};

const updateSubscription = (account: Account, request: Received, subscription: string): Answer => {
  if (!Arr.contains(account.subscriptions, subscription)) {
    return missing(missingPathStatus, `subscription: '${subscription}'`);
  }

  const cancelling = formField(request, "cancel_at_period_end") === "true";

  return ok({ cancel_at_period_end: cancelling, id: subscription, object: "subscription", status: "active" });
};

const answerFor = (account: Account, request: Received): Answer => {
  const subscription = Option.fromNullishOr(subscriptionPath.exec(request.path)?.groups?.id);

  if (request.method === "POST" && request.path === "/v1/checkout/sessions") {
    return checkout(account, request);
  }

  if (request.method === "POST" && request.path === "/v1/billing_portal/sessions") {
    return portal(account, request);
  }

  if (request.method === "POST" && Option.isSome(subscription)) {
    return updateSubscription(account, request, subscription.value);
  }

  return missing(missingPathStatus, `route: ${request.method} ${request.path}`);
};

// Stripe checks the key before anything else.
const answerTo = (account: Account, request: HttpServerRequest.HttpServerRequest, entry: Received): Answer => {
  const key = Headers.get(request.headers, "authorization");

  if (!Option.contains(key, `Bearer ${Redacted.value(standInKey)}`)) {
    return unauthorized;
  }

  return answerFor(account, entry);
};

// A local stand-in for the part of Stripe's HTTP API the adapter calls. It checks the key, parses the form body the
// Way Stripe does and answers in Stripe's shapes, including its resource_missing errors. It never calls Stripe, and it
// Listens on a port the operating system assigns.
const startStripeStandIn = (account: Account): Effect.Effect<StripeStandIn, never, Scope.Scope> =>
  Effect.gen(function* standIn() {
    const received = yield* Ref.make<readonly Received[]>([]);

    const handle = Effect.fn("StripeStandIn.handle")(function* handle(request: HttpServerRequest.HttpServerRequest) {
      const form = yield* Effect.orDie(request.urlParamsBody);
      const entry = { form, method: request.method, path: Arr.headNonEmpty(Str.split(request.url, "?")) };

      yield* Ref.update(received, Arr.append(entry));

      const answer = answerTo(account, request, entry);

      return HttpServerResponse.jsonUnsafe(answer.body, { status: answer.status });
    });

    const served = HttpRouter.serve(HttpRouter.add("*", "*", handle), {
      disableListenLog: true,
      disableLogger: true,
    }).pipe(Layer.provideMerge(layerTest));

    // A stand-in that cannot listen fails the test that started it, so its error is a defect.
    const context = yield* Effect.orDie(Layer.build(served));
    const baseUrl = yield* Effect.provideContext(HttpServer.addressFormattedWith(Effect.succeed), context);

    return { baseUrl, received: Ref.get(received) };
  });

export { standInKey, startStripeStandIn };
