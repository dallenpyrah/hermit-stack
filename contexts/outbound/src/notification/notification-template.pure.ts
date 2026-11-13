import { String as Str, pipe } from "effect";

interface RenderedNotification {
  readonly body: string;
  readonly title: string;
}

// The catalogue a fork fills in with one renderer per public event type; until then a kind such as invoice.paid
// Renders as "Invoice paid", so every kind can be sent.
const renderNotification = (kind: string): RenderedNotification => {
  const title = pipe(kind, Str.replaceAll(/[._-]+/gu, " "), Str.trim, Str.capitalize);

  return { body: `${title}. Open the app to see the details.`, title };
};

export { renderNotification };

export type { RenderedNotification };
