import { Function as Fn, String as Str, pipe } from "effect";

const nameArity = 2;

// A span is named <context>.<operation> in kebab case, such as ledger.open-account, whatever case the code names the
// Operation in. One naming rule lets a query find a context's spans on any telemetry backend.
const spanName: {
  (operation: string): (context: string) => string;
  (context: string, operation: string): string;
} = Fn.dual(
  nameArity,
  (context: string, operation: string): string => `${context}.${pipe(operation, Str.pascalToSnake, Str.snakeToKebab)}`,
);

export { spanName };
