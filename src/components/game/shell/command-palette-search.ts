/** Query matching and ranking for the command palette. Pure. */

export function queryTokens(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** True when every query token is a substring of the haystack. */
export function matchesTokens(haystack: string, tokens: string[]): boolean {
  const lower = haystack.toLowerCase();
  return tokens.every((token) => lower.includes(token));
}

/** 0 = label starts with the query, 1 = a word does, 2 = substring only. */
export function matchRank(label: string, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const lower = label.toLowerCase();
  const joined = tokens.join(" ");
  if (lower.startsWith(joined)) return 0;
  const words = lower.split(/[\s›]+/).filter(Boolean);
  const first = tokens[0]!;
  if (words.some((word) => word.startsWith(first))) return 1;
  return 2;
}

/**
 * Items whose `haystack` matches every token, best rank first (ties keep
 * their input order), capped at `limit`.
 */
export function rankMatches<T>(
  items: readonly T[],
  tokens: string[],
  text: (item: T) => { label: string; haystack: string },
  limit: number,
): T[] {
  const scored: Array<{ item: T; rank: number; order: number }> = [];
  items.forEach((item, order) => {
    const { label, haystack } = text(item);
    if (!matchesTokens(haystack, tokens)) return;
    scored.push({ item, rank: matchRank(label, tokens), order });
  });
  scored.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return scored.slice(0, limit).map((entry) => entry.item);
}
