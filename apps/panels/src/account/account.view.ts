import { create } from "@stylexjs/stylex";
import { Function as Fn } from "effect";
import type { Document, HtmlBuilder } from "foldkit/html";

import { styleAttributes } from "@repo/ui/style";
import { themeStyles } from "@repo/ui/theme";
import { space } from "@repo/ui/tokens.stylex";

import type { Message } from "#src/account/account.message.js";
import type { Model } from "#src/account/account.model.js";
import { accountCard } from "#src/account/view/account-card.view.js";
import { refused } from "#src/account/view/notice.view.js";

const styles = create({
  page: {
    boxSizing: "border-box",
    padding: space.xl,
  },
});

const title = "Ledger account";

const viewArity = 2;

// The panel paints in the host's theme, which arrives with the handshake and changes when the host's does.
const view: {
  (html: HtmlBuilder<Message>): (model: Model) => Document;
  (model: Model, html: HtmlBuilder<Message>): Document;
} = Fn.dual(viewArity, (model: Model, html: HtmlBuilder<Message>): Document => ({
  body: html.main(
    [html.DataAttribute("theme", model.theme), ...styleAttributes(...themeStyles(model.theme), styles.page)],
    [accountCard({ html, model })],
  ),
  title,
}));

// What the panel shows when it cannot run, most often because no MCP Apps host answered its handshake.
const crashView = (html: HtmlBuilder<never>): Document => ({
  body: html.main(styleAttributes(...themeStyles("light"), styles.page), [
    refused(
      { reason: "Open it from an agent host that supports MCP Apps.", title: "This panel could not start" },
      html,
    ),
  ]),
  title,
});

export { crashView, view };
