import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/prose.css";
import "./styles/search.css";
import "./styles/menus.css";
import "./styles/landing.css";

import type { Metadata, Viewport } from "next";
import type { ReactElement, ReactNode } from "react";

import { scrollRestoreScript } from "#src/content/script/scroll-restore-script.pure.ts";
import { themeScript } from "#src/content/script/theme-script.pure.ts";
import { siteDescription, siteName, siteUrl } from "#src/content/site/site.pure.ts";
import { geistMono, inter } from "./fonts.config.ts";

interface LayoutProps {
  readonly children: ReactNode;
}

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  applicationName: siteName,
  description: siteDescription,
  icons: { icon: "/favicon.svg" },
  metadataBase: new URL(siteUrl),
  openGraph: { locale: "en_US", siteName, type: "website" },
  title: { default: `${siteName} documentation`, template: `%s - ${siteName}` },
  twitter: { card: "summary" },
};

const RootLayout = ({ children }: LayoutProps): ReactElement => (
  <html className={`${inter.variable} ${geistMono.variable}`} lang="en" suppressHydrationWarning>
    <head>
      <link blocking="render" href="#end-of-page" rel="expect" />
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
    </head>
    <body>
      {children}
      <script dangerouslySetInnerHTML={{ __html: scrollRestoreScript }} />
      <div hidden id="end-of-page" />
    </body>
  </html>
);

export default RootLayout;
