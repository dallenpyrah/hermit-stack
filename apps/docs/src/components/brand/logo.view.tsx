import type { ReactElement } from "react";

import { siteName } from "#src/content/site/site.pure.ts";

export const Logo = (props: { readonly mark: string }): ReactElement => (
  <>
    <span className="hs-mark-frame" dangerouslySetInnerHTML={{ __html: props.mark }} />
    <span className="hs-wordmark-text">{siteName}</span>
  </>
);
