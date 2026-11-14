import { Rejection } from "@alchemy.run/domain";
import { Schema } from "effect";

class PayerNotFound extends Rejection(
  "PayerNotFound",
  { payer: Schema.String },
  { description: "The processor holds no payer with this reference." },
) {}

export { PayerNotFound };
