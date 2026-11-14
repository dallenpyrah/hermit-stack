declare const stored: object;

// SAFETY: the row was written by this module, which only stores seat counts.
export const seats = stored as { readonly count: number };
