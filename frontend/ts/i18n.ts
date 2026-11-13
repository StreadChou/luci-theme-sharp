/** Theme messages use the same PO/LMO catalogs and language as native LuCI. */
export function t(message: string): string {
  // Login templates are translated on the server and do not load LuCI's JS API.
  return typeof _ === 'function' ? _(message, 'sharp') : message;
}

export function tn(count: number, singular: string, plural: string): string {
  const message = typeof N_ === 'function' ? N_(count, singular, plural, 'sharp')
    : count === 1 ? singular : plural;
  return message.replace(/%d/g, String(count));
}
