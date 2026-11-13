import { RuleTester } from "oxlint/plugins-dev";

import { preferEffectMatchRule } from "#oxlint/anti-slop/effect/rules/prefer-effect-match";

new RuleTester().run("prefer-effect-match", preferEffectMatchRule, {
	valid: [
		'kind === "a" ? first : fallback;',
		'kind === "a" ? first : other === "b" ? second : fallback;',
		"condition ? first : otherCondition ? second : fallback;",
	],
	invalid: [
		{
			code: 'kind === "a" ? first : kind === "b" ? second : fallback;',
			errors: [{ messageId: "preferMatch" }],
		},
		{
			code: '`a` !== kind ? first : `b` === kind ? second : fallback;',
			errors: [{ messageId: "preferMatch" }],
		},
	],
});
