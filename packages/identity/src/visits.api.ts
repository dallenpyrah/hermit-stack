import { Api } from "@alchemy.run/domain";

import { VisitsModel } from "#src/visits.model.js";

class VisitsApi extends Api("VisitsApi", { commands: ["CheckIn"], model: VisitsModel }) {}

export { VisitsApi };
