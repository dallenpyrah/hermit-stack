import { Schema } from "effect";

// Each tenant has one feed, so the tenant id addresses it.
const TenantId = Schema.String.pipe(Schema.brand("TenantId"));

type TenantId = typeof TenantId.Type;

export { TenantId };
