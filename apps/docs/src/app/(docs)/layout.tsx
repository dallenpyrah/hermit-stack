import type { ReactElement, ReactNode } from "react";

import { DocsShell } from "#src/components/shell/docs-shell.view.tsx";
import { logoMark } from "#src/content/site/logo-mark.build.ts";

interface LayoutProps {
  readonly children: ReactNode;
}

const DocsRouteLayout = ({ children }: LayoutProps): ReactElement => <DocsShell mark={logoMark}>{children}</DocsShell>;

export default DocsRouteLayout;
