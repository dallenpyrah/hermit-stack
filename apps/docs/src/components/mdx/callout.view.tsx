import { Schema } from "effect";
import { CircleCheck, Construction, Info, Lightbulb, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

const CalloutKind = Schema.Literals(["idea", "info", "planned", "success", "warning"]);

type CalloutKind = typeof CalloutKind.Type;

const defaultKind = "info";

const kinds: Readonly<Record<CalloutKind, { Icon: LucideIcon; title: string }>> = {
  [defaultKind]: { Icon: Info, title: "Note" },
  idea: { Icon: Lightbulb, title: "Tip" },
  planned: { Icon: Construction, title: "Planned" },
  success: { Icon: CircleCheck, title: "Check" },
  warning: { Icon: TriangleAlert, title: "Warning" },
};

const isKind = Schema.is(CalloutKind);

const kindOf = (type?: string): CalloutKind => {
  if (isKind(type)) {
    return type;
  }

  return defaultKind;
};

export const Callout = (props: { readonly type?: string; readonly children?: ReactNode }): ReactElement => {
  const kind = kindOf(props.type);
  const { Icon, title } = kinds[kind];

  return (
    <div className="hs-callout" data-kind={kind} role="note" aria-label={title}>
      <Icon aria-hidden="true" />
      <div className="hs-callout-body">{props.children}</div>
    </div>
  );
};
