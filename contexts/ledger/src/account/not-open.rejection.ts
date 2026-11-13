import { Rejection } from "@alchemy.run/domain";

class NotOpen extends Rejection(
  "NotOpen",
  {},
  { description: "The account has not been opened, or it has been closed." },
) {}

export { NotOpen };
