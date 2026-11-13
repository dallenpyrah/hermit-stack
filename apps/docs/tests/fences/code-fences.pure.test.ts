import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { pageAlignedSource, typeScriptFences } from "#src/fences/code-fences.pure.ts";

const page = `---
title: A page
---

\`\`\`sh
pnpm check
\`\`\`

Text.

\`\`\`ts title="a.ts"
const a = 1;
const b = 2;
\`\`\`

1. A step:

   \`\`\`typescript
   const c = 3;
     const d = 4;
   \`\`\`

\`\`\`\`md
\`\`\`ts
const shown = "not checked";
\`\`\`
\`\`\`\`
`;

const findsOnlyTypeScript = (): void => {
  expect(typeScriptFences(page)).toStrictEqual([
    { code: "const a = 1;\nconst b = 2;", language: "ts", line: 12 },
    { code: "const c = 3;\n  const d = 4;", language: "typescript", line: 19 },
  ]);
};

const keepsPageLines = (): void => {
  expect(pageAlignedSource({ code: "const a = 1;\nconst b = 2;", language: "ts", line: 3 })).toBe(
    "\n\nconst a = 1;\nconst b = 2;\n",
  );
};

describe("the TypeScript fences of a page", () => {
  it.effect("are found outside other fences, with the page line their code starts on", () =>
    Effect.sync(findsOnlyTypeScript),
  );
  it.effect("are written with their code on the same lines as on the page", () => Effect.sync(keepsPageLines));
});
