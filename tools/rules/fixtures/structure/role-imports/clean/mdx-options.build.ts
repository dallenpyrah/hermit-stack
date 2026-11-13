import { remarkDeadLinks } from "./remark-docs.build.ts";

export const mdxOptions = (themes: readonly string[]) => ({
  rehypeCodeOptions: { themes },
  remarkPlugins: [remarkDeadLinks],
});
