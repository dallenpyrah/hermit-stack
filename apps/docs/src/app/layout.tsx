import "./global.css";

import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";

import { Provider } from "#src/components/provider.view.tsx";
import { siteDescription, siteName } from "#src/content/site.pure.ts";

interface LayoutProps {
  readonly children: ReactNode;
}

export const metadata: Metadata = {
  description: siteDescription,
  title: { default: siteName, template: `%s | ${siteName}` },
};

const RootLayout = ({ children }: LayoutProps): ReactElement => (
  <html lang="en" suppressHydrationWarning>
    <body className="flex min-h-screen flex-col">
      <Provider>{children}</Provider>
    </body>
  </html>
);

export default RootLayout;
