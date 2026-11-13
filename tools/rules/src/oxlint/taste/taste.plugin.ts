import { definePlugin } from "@oxlint/plugins";

import { effectFnNameMatchesBinding } from "./effect-fn-name-matches-binding.rule.js";
import { namedEffectFn } from "./named-effect-fn.rule.js";
import { noGrabBagModules } from "./no-grab-bag-modules.rule.js";
import { noPipeOnEffectFn } from "./no-pipe-on-effect-fn.rule.js";
import { noTypePredicates } from "./no-type-predicates.rule.js";
import { noUnboundedConcurrency } from "./no-unbounded-concurrency.rule.js";
import { noVagueNames } from "./no-vague-names.rule.js";
import { reportMessageFormat } from "./report-message-format.rule.js";
import { taggedErrorSuffix } from "./tagged-error-suffix.rule.js";

export default definePlugin({
  meta: { name: "taste" },
  rules: {
    "effect-fn-name-matches-binding": effectFnNameMatchesBinding,
    "named-effect-fn": namedEffectFn,
    "no-grab-bag-modules": noGrabBagModules,
    "no-pipe-on-effect-fn": noPipeOnEffectFn,
    "no-type-predicates": noTypePredicates,
    "no-unbounded-concurrency": noUnboundedConcurrency,
    "no-vague-names": noVagueNames,
    "report-message-format": reportMessageFormat,
    "tagged-error-suffix": taggedErrorSuffix,
  },
});
