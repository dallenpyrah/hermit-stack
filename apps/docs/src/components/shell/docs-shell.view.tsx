import type { ReactElement, ReactNode } from "react";

import { sidebar } from "#src/content/site/source.config.ts";
import { Logo } from "#src/components/brand/logo.view.tsx";
import { Shell } from "./shell.view.tsx";

export const DocsShell = (props: { readonly children: ReactNode; readonly mark: string }): ReactElement => (
  <Shell logo={<Logo mark={props.mark} />} sidebar={sidebar}>
    {props.children}
  </Shell>
);
