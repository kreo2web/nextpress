/**
 * The `?next=` address to return to after signing in, only when it is a path on this same site
 * ("/join/abc"). Anything else ("//evil.com", "https://…") is ignored, so the link can't send
 * someone to another site after they sign in.
 */
export function readSafeNextPath(search: string): string | null {
  const next = new URLSearchParams(search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
  return next;
}
