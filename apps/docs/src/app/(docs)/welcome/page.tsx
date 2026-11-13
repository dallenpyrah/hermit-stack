import type { Metadata } from "next";
import type { ReactElement } from "react";

import { Landing } from "#src/components/landing/landing.view.tsx";
import { landingMetadata, welcomePage } from "#src/content/navigation/landing-pages.pure.ts";
import { siteUrl } from "#src/content/site/site.pure.ts";

export const metadata: Metadata = landingMetadata(siteUrl, welcomePage);

const Page = (): ReactElement => <Landing page={welcomePage} />;

export default Page;
