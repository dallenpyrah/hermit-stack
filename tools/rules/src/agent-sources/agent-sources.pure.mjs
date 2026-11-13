const catalogLine = /^ {2}(?:"(?<quoted>[^"]+)"|(?<bare>[^\s:#"]+)):\s*"?(?<pin>[^"#\s]+)"?/u;

const catalogOf = (workspaceYaml) => {
  const lines = workspaceYaml.split("\n");
  const start = lines.findIndex((line) => line.trimEnd() === "catalog:");
  const rest = start === -1 ? [] : lines.slice(start + 1);
  const end = rest.findIndex((line) => line.trim() !== "" && !/^\s/u.test(line));
  return Object.fromEntries(
    (end === -1 ? rest : rest.slice(0, end)).flatMap((line) => {
      const groups = catalogLine.exec(line)?.groups;
      return groups === undefined ? [] : [[groups.quoted ?? groups.bare, groups.pin]];
    }),
  );
};

const pinOf = (name, catalog, manifest) => {
  const declared = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
  return declared === undefined || declared === "catalog:" ? catalog[name] : declared;
};

const repositoryUrlOf = (repository) => {
  const url = typeof repository === "string" ? repository : repository?.url;
  if (url === undefined) {
    return undefined;
  }
  const shorthand = /^(?:github:)?(?<path>[\w.-]+\/[\w.-]+)$/u.exec(url)?.groups?.path;
  return shorthand === undefined ? url.replace(/^git\+/u, "") : `https://github.com/${shorthand}.git`;
};

const tagCandidates = (name, version) => [`${name}@${version}`, `v${version}`, version];

export { catalogOf, pinOf, repositoryUrlOf, tagCandidates };
