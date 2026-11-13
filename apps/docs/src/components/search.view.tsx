"use client";

import { useStaticSearch } from "fumadocs-core/search/client";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
} from "fumadocs-ui/components/dialog/search";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import type { ReactElement } from "react";

// The site is a static export, so the browser downloads the index that /api/search wrote at build time and searches it.
const StaticSearchDialog = (props: SharedProps): ReactElement => {
  const search = useStaticSearch({ from: "/api/search" });

  return (
    <SearchDialog {...props} {...search}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList />
      </SearchDialogContent>
    </SearchDialog>
  );
};

export { StaticSearchDialog };
