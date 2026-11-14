import { Function as Fn, String as Str, pipe } from "effect";

const nameArity = 2;

const spanName: {
  (operation: string): (context: string) => string;
  (context: string, operation: string): string;
} = Fn.dual(
  nameArity,
  (context: string, operation: string): string => `${context}.${pipe(operation, Str.pascalToSnake, Str.snakeToKebab)}`,
);

export { spanName };
