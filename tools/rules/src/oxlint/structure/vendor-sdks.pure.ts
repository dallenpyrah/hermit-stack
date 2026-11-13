const vendorSdks = {
  "@aws-sdk/": "@distilled.cloud/aws for API calls, or @alchemy.run/aws for infrastructure",
  "@octokit/": "@distilled.cloud/github for API calls, or @alchemy.run/github for infrastructure",
  archil: "@distilled.cloud/archil for API calls, or @alchemy.run/archil for infrastructure",
  cloudflare: "@distilled.cloud/cloudflare for API calls, or @alchemy.run/cloudflare for infrastructure",
  disk: "@distilled.cloud/archil for API calls, or @alchemy.run/archil for infrastructure",
  octokit: "@distilled.cloud/github for API calls, or @alchemy.run/github for infrastructure",
  resend: "@distilled.cloud/resend",
  stripe: "@distilled.cloud/stripe for API calls, or @alchemy.run/stripe for infrastructure",
} as const satisfies Readonly<Record<string, string>>;

export { vendorSdks };
