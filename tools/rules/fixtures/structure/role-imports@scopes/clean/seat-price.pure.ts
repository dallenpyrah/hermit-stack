import type { Wal } from "@akter-cloud/fixture/wal";
import { Plan } from "@akter-cloud/fixture/plan";
import { total } from "@akter-cloud/fixture/price";

export const price = (wal: typeof Wal) => [wal, Plan, total, import("@akter-cloud/fixture/plan")];
