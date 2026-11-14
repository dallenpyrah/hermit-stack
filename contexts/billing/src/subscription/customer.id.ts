import { Schema } from "effect";

const CustomerId = Schema.String.pipe(Schema.brand("CustomerId"));

type CustomerId = typeof CustomerId.Type;

export { CustomerId };
