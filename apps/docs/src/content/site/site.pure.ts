interface RepositoryTarget {
  readonly directory: boolean;
  readonly path: string;
}

const siteName = "hermit-stack";

const siteDescription =
  "A template monorepo to fork for a new product: one Effect program, where the host, the cloud and every vendor are Layers you swap.";

const siteUrl = "https://docs.hermit-stack.dev";

const repositoryUrl = "https://github.com/dallenpyrah/hermit-stack";

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
