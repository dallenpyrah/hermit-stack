import { Model } from "@alchemy.run/domain";

import { Visits } from "#src/visits/visits.aggregate.js";

// The sample model the Session contract drives: one aggregate whose one command lists the Session middleware.
class VisitsModel extends Model("Visits", { aggregates: [Visits] }) {}

export { VisitsModel };
