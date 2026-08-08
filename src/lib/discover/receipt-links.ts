export function canonicalOutcomeHref(publicReference: string) {
  const reference = publicReference.trim();
  if (!reference) throw new Error("A receipt public reference is required.");
  return `/outcomes/${encodeURIComponent(reference)}`;
}
