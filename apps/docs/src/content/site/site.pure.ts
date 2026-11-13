interface RepositoryTarget {
  readonly directory: boolean;
  readonly path: string;
}

const siteName = "hermitstack";

const siteDescription =
  "A template monorepo to fork for a new product: one Effect program, where the host, the cloud and every vendor are Layers you swap.";

// Where the site will be served. Absolute links in llms.txt, the sitemap and the Markdown twins start here; nothing is
// Hosted yet, so change this one value when the site gets a domain.
const siteUrl = "https://docs.hermitstack.dev";

// The repository behind "Edit this page", the sidebar link and links to files in the pages.
const repositoryUrl = "https://github.com/dallenpyrah/hermitstack";

const repositoryBranch = "main";

const contentPath = "apps/docs/content";

const kindOf = (directory: boolean): string => {
  if (directory) {
    return "tree";
  }

  return "blob";
};

const repositoryLink = (input: RepositoryTarget): string =>
  `${repositoryUrl}/${kindOf(input.directory)}/${repositoryBranch}/${input.path}`;

const editLink = (path: string): string => `${repositoryUrl}/edit/${repositoryBranch}/${path}`;

export { contentPath, editLink, repositoryLink, repositoryUrl, siteDescription, siteName, siteUrl };
