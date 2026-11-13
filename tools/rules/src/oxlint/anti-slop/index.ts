import { eslintCompatPlugin } from "@oxlint/plugins";

import { noArrayFilterMapRule } from "./rules/values/no-array-filter-map.ts";
import { noReduceAccumulatorCopyRule } from "./rules/values/no-reduce-accumulator-copy.ts";
import { noChainedTypeAssertionsRule } from "./rules/types/no-chained-type-assertions.ts";
import { noConditionalEmptyObjectSpreadRule } from "./rules/values/no-conditional-empty-object-spread.ts";
import { noKnownValueWideningRule } from "./rules/types/no-known-value-widening.ts";
import { noModuleMockingRule } from "./rules/conventions/no-module-mocking.ts";
import { noObjectParametersRule } from "./rules/values/no-object-parameters.ts";
import { noReflectApplyRule } from "./rules/values/no-reflect-apply.ts";
import { noReflectGetRule } from "./rules/values/no-reflect-get.ts";
import { noRuntimeTypeofRule } from "./rules/types/no-runtime-typeof.ts";
import { noForbiddenTermInSymbolNamesRule } from "./rules/conventions/no-shape-in-symbol-names.ts";
import { noUnknownParametersRule } from "./rules/types/no-unknown-parameters.ts";
import { noUnknownReturnsRule } from "./rules/types/no-unknown-returns.ts";
import { noUnknownTypeAliasesRule } from "./rules/types/no-unknown-type-aliases.ts";
import { noUnsafeDictionaryTypeRule } from "./rules/types/no-unsafe-dictionary-type.ts";
import { noWidenThenAssertRule } from "./rules/types/no-widen-then-assert.ts";
import { requireReadableSpacingRule } from "./rules/conventions/require-readable-spacing.ts";
import { requireSafetyCommentForTypeAssertionRule } from "./rules/types/require-safety-comment-for-type-assertion.ts";

/** Generic Oxlint rules that reject low-evidence and low-signal implementation patterns. */
const antiSlopPlugin = eslintCompatPlugin({
	meta: { name: "anti-slop" },
	rules: {
		"no-array-filter-map": noArrayFilterMapRule,
		"no-reduce-accumulator-copy": noReduceAccumulatorCopyRule,
		"no-chained-type-assertions": noChainedTypeAssertionsRule,
		"no-conditional-empty-object-spread": noConditionalEmptyObjectSpreadRule,
		"no-known-value-widening": noKnownValueWideningRule,
		"no-module-mocking": noModuleMockingRule,
		"no-object-parameters": noObjectParametersRule,
		"no-reflect-apply": noReflectApplyRule,
		"no-reflect-get": noReflectGetRule,
		"no-runtime-typeof": noRuntimeTypeofRule,
		"no-unsafe-dictionary-type": noUnsafeDictionaryTypeRule,
		"no-shape-in-symbol-names": noForbiddenTermInSymbolNamesRule,
		"no-unknown-parameters": noUnknownParametersRule,
		"no-unknown-returns": noUnknownReturnsRule,
		"no-unknown-type-aliases": noUnknownTypeAliasesRule,
		"no-widen-then-assert": noWidenThenAssertRule,
		"require-readable-spacing": requireReadableSpacingRule,
		"require-safety-comment-for-type-assertion": requireSafetyCommentForTypeAssertionRule,
	},
});

export default antiSlopPlugin;
