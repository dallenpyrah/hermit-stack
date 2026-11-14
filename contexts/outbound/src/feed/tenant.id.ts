import { Schema } from "effect";

const TenantId = Schema.String.pipe(Schema.brand("TenantId"));

type TenantId = typeof TenantId.Type;

export { TenantId };
