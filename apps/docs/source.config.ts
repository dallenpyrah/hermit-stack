import { defineConfig, defineDocs } from "fumadocs-mdx/config";

const docs = defineDocs({ dir: "content/docs" });

const config = defineConfig();

export { docs };

export default config;
