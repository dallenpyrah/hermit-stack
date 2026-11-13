"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactElement, ReactNode } from "react";

import { StaticSearchDialog } from "#src/components/search.view.tsx";

interface ProviderProps {
  readonly children: ReactNode;
}

// The root layout is a server component and cannot hand RootProvider a component, so this client file does.
const Provider = ({ children }: ProviderProps): ReactElement => (
  <RootProvider search={{ SearchDialog: StaticSearchDialog }}>{children}</RootProvider>
);

export { Provider };
