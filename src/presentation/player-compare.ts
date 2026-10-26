/**
 * Side-by-side player comparison rows: OVR, the seven attribute groups and
 * every attribute. Deltas are always b - a. Pure presentation; never feeds
 * gameplay.
 */

import type { PlayerAttributes } from "@/domain/entities/player";
import { categoryRatings } from "@/presentation/player-rating-categories";

export type CompareRowKind = "overall" | "group" | "attribute";

export type CompareRow = {
  key: string;
  label: string;
  kind: CompareRowKind;
  a: number;
  b: number;
  /** b - a. */
  delta: number;
};

export type DeltaTone = "win" | "loss" | "neutral";

export function deltaTone(delta: number): DeltaTone {
  return delta > 0 ? "win" : delta < 0 ? "loss" : "neutral";
}

/** "+3", "−2" (true minus sign) or "0". */
export function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${Math.abs(delta)}`;
  return "0";
}

type Comparable = { overall: number; attributes: PlayerAttributes };

export function buildCompareRows(a: Comparable, b: Comparable): CompareRow[] {
  const rows: CompareRow[] = [
    {
      key: "overall",
      label: "Overall",
      kind: "overall",
      a: a.overall,
      b: b.overall,
      delta: b.overall - a.overall,
    },
  ];
  const groupsB = categoryRatings(b.attributes);
  categoryRatings(a.attributes).forEach((group, i) => {
    const other = groupsB[i]!;
    rows.push({
      key: group.key,
      label: group.label,
      kind: "group",
      a: group.rating,
      b: other.rating,
      delta: other.rating - group.rating,
    });
    group.attributes.forEach((attribute, j) => {
      const otherRating = other.attributes[j]!.rating;
      rows.push({
        key: `${group.key}:${attribute.key}`,
        label: attribute.label,
        kind: "attribute",
        a: attribute.rating,
        b: otherRating,
        delta: otherRating - attribute.rating,
      });
    });
  });
  return rows;
}

/** Compare page URL for the two slots; empty slots are omitted. */
export function compareHref(
  saveId: string,
  slots: { a?: string | null; b?: string | null },
): string {
  const params = new URLSearchParams();
  if (slots.a) params.set("a", slots.a);
  if (slots.b) params.set("b", slots.b);
  const query = params.toString();
  return `/dashboard/${saveId}/players/compare${query ? `?${query}` : ""}`;
}
