import { HomeLayout } from "fumadocs-ui/layouts/home";
import Link from "next/link";
import type { ReactElement } from "react";

import { layoutOptions, siteDescription, siteMark, siteName, siteTagline } from "#src/content/site.pure.ts";

const crab = ["Effect", "FoldKit", "Alchemy", "StyleX", "Oxlint"];

const shell = ["the host that runs your actors", "the cloud it runs on", "each vendor: auth, billing, mail, storage"];

const HomePage = (): ReactElement => (
  <HomeLayout {...layoutOptions}>
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-20">
      <header className="flex flex-col gap-4">
        <span aria-hidden="true" className="text-5xl">
          {siteMark}
        </span>
        <h1 className="text-4xl font-semibold tracking-tight">{siteName}</h1>
        <p className="text-2xl text-fd-foreground">{siteTagline}</p>
        <p className="text-lg text-fd-muted-foreground">{siteDescription}</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border bg-fd-card p-5">
          <h2 className="font-medium">The crab never changes</h2>
          <ul className="mt-3 flex flex-col gap-1 text-sm text-fd-muted-foreground">
            {crab.map((part) => (
              <li key={part}>{part}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border bg-fd-card p-5">
          <h2 className="font-medium">A fork swaps the shell</h2>
          <ul className="mt-3 flex flex-col gap-1 text-sm text-fd-muted-foreground">
            {shell.map((part) => (
              <li key={part}>{part}</li>
            ))}
          </ul>
        </section>
      </div>
      <nav className="flex flex-wrap gap-3">
        <Link
          className="rounded-md bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground"
          href="/docs/getting-started"
        >
          Get started
        </Link>
        <Link className="rounded-md border px-4 py-2 text-sm font-medium" href="/docs">
          What hermitstack is
        </Link>
      </nav>
    </main>
  </HomeLayout>
);

export default HomePage;
