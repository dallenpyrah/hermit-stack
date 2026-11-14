import { Model } from "@alchemy.run/domain";

import { Visits } from "#src/visits/visits.aggregate.js";

class VisitsModel extends Model("Visits", { aggregates: [Visits] }) {}

export { VisitsModel };
