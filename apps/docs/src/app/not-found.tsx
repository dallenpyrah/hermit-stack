import Link from "next/link";
import type { ReactElement } from "react";

import { DocsShell } from "#src/components/shell/docs-shell.view.tsx";
import { logoMark } from "#src/content/site/logo-mark.build.ts";

const NotFound = (): ReactElement => (
  <DocsShell mark={logoMark}>
    <article className="hs-page hs-landing" data-kind="landing">
      <section className="hs-hero">
        <h1 className="hs-hero-title">Page not found</h1>
        <div className="hs-hero-lede">
          <p>The page you are looking for does not exist, or it has moved.</p>
        </div>
        <div className="hs-hero-actions">
          <Link className="hs-btn hs-btn-lg" href="/welcome">
            Back to the docs
          </Link>
        </div>
      </section>
    </article>
  </DocsShell>
);

export default NotFound;
