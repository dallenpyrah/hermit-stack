import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { isValidElement } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { languageLabel, languageOf } from "#src/content/markdown/code-languages.pure.ts";
import { Callout } from "./callout.view.tsx";
import { CopyCodeButton } from "./copy-code-button.view.tsx";
import { H2, H3, H4 } from "./headings.view.tsx";

const Anchor = ({
  href,
  ...rest
}: Omit<ComponentProps<"a">, "onClick" | "onMouseEnter" | "onTouchStart">): ReactElement => {
  if (href?.startsWith("/") === true) {
    return <Link href={href} {...rest} />;
  }

  return <a href={href} {...rest} />;
};

interface CodeProps {
  readonly className?: string;
}

const codeProps = (children: ReactNode): CodeProps => {
  if (isValidElement<CodeProps>(children)) {
    return children.props;
  }

  return {};
};

const terminalLanguages = new Set(["bash", "sh", "shell"]);

type PreProps = ComponentProps<"pre"> & { readonly icon?: string };

const CodeBlock = ({ icon: _icon, title, ...props }: PreProps): ReactElement => {
  const language = languageOf(codeProps(props.children).className);

  return (
    <div className="hs-code" data-code="true" data-terminal={terminalLanguages.has(language ?? "")}>
      <div className="hs-code-head">
        <span className="hs-code-lang">{title ?? languageLabel(language)}</span>
        <CopyCodeButton />
      </div>
      <pre {...props} />
    </div>
  );
};

const Table = (props: ComponentProps<"table">): ReactElement => (
  <div className="hs-table">
    <table {...props} />
  </div>
);

const anchorTag = "a";

export const mdxComponents: MDXComponents = {
  [anchorTag]: Anchor,
  callout: Callout,
  h2: H2,
  h3: H3,
  h4: H4,
  pre: CodeBlock,
  table: Table,
};
