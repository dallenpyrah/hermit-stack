import { String as Str, pipe } from "effect";

interface RenderedNotification {
  readonly body: string;
  readonly title: string;
}

const renderNotification = (kind: string): RenderedNotification => {
  const title = pipe(kind, Str.replaceAll(/[._-]+/gu, " "), Str.trim, Str.capitalize);

  return { body: `${title}. Open the app to see the details.`, title };
};

export { renderNotification };

export type { RenderedNotification };
