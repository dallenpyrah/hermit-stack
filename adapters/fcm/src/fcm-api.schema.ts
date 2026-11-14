import { Schema } from "effect";

const SentMessage = Schema.Struct({ name: Schema.String });

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

const AccessToken = Schema.Struct({ access_token: Schema.String, expires_in: Schema.Int });

export { AccessToken, FcmError, SentMessage };
