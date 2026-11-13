import { Rejection } from "@alchemy.run/domain";

class AlreadyOpen extends Rejection(
  "AlreadyOpen",
  {},
  { description: "An account with this id has already been opened." },
) {}

export { AlreadyOpen };
