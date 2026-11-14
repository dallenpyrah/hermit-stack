import { Rejection } from "@alchemy.run/domain";

class NotSubscribed extends Rejection(
  "NotSubscribed",
  {},
  { description: "The customer has no subscription to cancel: it never started, or it has already ended." },
) {}

export { NotSubscribed };
