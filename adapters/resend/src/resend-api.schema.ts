import { Schema } from "effect";

// What POST /emails answers when Resend accepts the email: https://resend.com/docs/api-reference/emails/send-email
const SentEmail = Schema.Struct({ id: Schema.String });

// The body of every Resend error, such as { "name": "validation_error", "statusCode": 422, "message": "..." }:
// Https://resend.com/docs/api-reference/errors
const ResendError = Schema.Struct({ message: Schema.String, name: Schema.String });

type ResendError = typeof ResendError.Type;

export { ResendError, SentEmail };
