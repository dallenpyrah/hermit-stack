import { Schema } from "effect";

// What messages:send answers when FCM accepts the message, its name such as projects/p/messages/0:1500415314455276:
// Https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send
const SentMessage = Schema.Struct({ name: Schema.String });

// The body of every FCM error, whose FcmError detail names the error code:
// Https://firebase.google.com/docs/cloud-messaging/error-codes
const FcmErrorDetail = Schema.Struct({ errorCode: Schema.optionalKey(Schema.String) });

const FcmErrorDetails = Schema.optionalKey(Schema.Array(FcmErrorDetail));

const FcmError = Schema.Struct({
  error: Schema.Struct({
    details: FcmErrorDetails,
    message: Schema.String,
    status: Schema.String,
  }),
});

type FcmError = typeof FcmError.Type;

// What Google's token endpoint answers for a service account's signed assertion:
// Https://developers.google.com/identity/protocols/oauth2/service-account#httprest
const AccessToken = Schema.Struct({ access_token: Schema.String, expires_in: Schema.Int });

export { AccessToken, FcmError, SentMessage };
