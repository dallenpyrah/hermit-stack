declare const stored: object;

/* SAFETY: the row was written by this module. */
export const seats = stored as { readonly count: number };
