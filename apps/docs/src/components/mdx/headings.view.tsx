import { Option } from "effect";
import type { ComponentProps, ReactElement } from "react";

import { LinkGlyph } from "#src/components/brand/glyphs.view.tsx";

const WORD_JOINER = "\u2060";

type HeadingTag = "h2" | "h3" | "h4";

type AnchoredProps = ComponentProps<"h2"> & { readonly tag: HeadingTag };

const AnchoredHeading = ({ children, id, tag: Tag, ...rest }: AnchoredProps): ReactElement => (
  <Tag id={id} {...rest}>
    {Option.match(Option.fromNullishOr(id), {
      onNone: () => children,
      onSome: (anchor): ReactElement => (
        <a href={`#${anchor}`} className="hs-anchor">
          {children}
          {WORD_JOINER}
          <span className="hs-anchor-icon">
            <LinkGlyph aria-hidden="true" />
          </span>
        </a>
      ),
    })}
  </Tag>
);

const H2 = (props: ComponentProps<"h2">): ReactElement => <AnchoredHeading tag="h2" {...props} />;

const H3 = (props: ComponentProps<"h2">): ReactElement => <AnchoredHeading tag="h3" {...props} />;

const H4 = (props: ComponentProps<"h2">): ReactElement => <AnchoredHeading tag="h4" {...props} />;

export { H2, H3, H4 };
