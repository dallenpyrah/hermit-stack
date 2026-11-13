import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactElement, ReactNode } from "react";

import { layoutOptions } from "#src/content/site.pure.ts";
import { source } from "#src/content/source.build.ts";

interface LayoutProps {
  readonly children: ReactNode;
}

const DocsRouteLayout = ({ children }: LayoutProps): ReactElement => (
  <DocsLayout tree={source.getPageTree()} {...layoutOptions}>
    {children}
  </DocsLayout>
);

export default DocsRouteLayout;
