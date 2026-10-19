import type { PlayerId } from "@/domain/ids";

/** Axis-aligned box in court pixels. */
export type Box = { left: number; top: number; right: number; bottom: number };

export type LabelSide = "below" | "above" | "right" | "left";

/** Side of the square a token occupies for collision purposes (px). */
export const TOKEN_OBSTACLE_PX = 32;
/** Side of the square a rim occupies for collision purposes (px). */
export const RIM_OBSTACLE_PX = 24;
/** Height of a name label (px). */
export const LABEL_HEIGHT_PX = 20;
/** Widest a name label gets (px); longer names truncate. */
export const LABEL_MAX_WIDTH_PX = 96;
/** Label width is this padding plus a per-character estimate, capped. */
export const LABEL_PADDING_PX = 8;
export const LABEL_CHAR_PX = 7.5;
/** Token disc radius (px); a label sits `LABEL_GAP_PX` beyond it. */
export const TOKEN_RADIUS_PX = 16;
export const LABEL_GAP_PX = 4;
/** How far past the court rectangle a label may reach (px). */
export const COURT_MARGIN_PX = 8;

const SIDES: readonly LabelSide[] = ["below", "above", "right", "left"];

// ---------------------------------------------------------------------------
// Monograms
// ---------------------------------------------------------------------------

type MonogramInput = {
  playerId: PlayerId;
  fullName: string;
  lastName?: string;
  shortName?: string;
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Uppercase A-Z letters of a word, diacritics stripped. */
function letters(word: string | undefined): string {
  return (word ?? "")
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

function words(text: string | undefined): string[] {
  return (text ?? "").trim().split(/\s+/).filter(Boolean);
}

function candidatesFor(player: MonogramInput): string[] {
  const first = letters(words(player.fullName)[0]);
  const last =
    letters(player.lastName) ||
    letters(words(player.shortName).pop()) ||
    letters(words(player.fullName).pop());
  const f = first || last;
  const l = last || first;
  const out: string[] = [];
  const push = (value: string) => {
    if (value.length === 2 && !out.includes(value)) {
      out.push(value);
    }
  };
  if (f && l) {
    push(f[0]! + l[0]!);
    for (let k = 1; k < l.length; k++) {
      push(l[0]! + l[k]!);
      push(f[0]! + l[k]!);
    }
    if (f.length > 1) {
      push(f[0]! + f[1]!);
    }
    for (const letter of ALPHABET) {
      push(l[0]! + letter);
    }
  }
  // Nameless players, and the last resort for crowded rosters.
  for (const letter of ALPHABET) {
    push(`?${letter}`);
  }
  for (const a of ALPHABET) {
    for (const b of ALPHABET) {
      push(a + b);
    }
  }
  return out;
}

const monogramCache = new WeakMap<
  ReadonlyArray<MonogramInput>,
  Map<PlayerId, string>
>();

/**
 * Two-letter monograms, unique across the whole list. Players are assigned in
 * input order, each taking its first candidate nobody holds yet.
 */
export function courtMonograms(
  players: ReadonlyArray<MonogramInput>,
): Map<PlayerId, string> {
  const cached = monogramCache.get(players);
  if (cached) {
    return cached;
  }
  const taken = new Set<string>();
  const result = new Map<PlayerId, string>();
  for (const player of players) {
    if (result.has(player.playerId)) {
      continue;
    }
    const pick = candidatesFor(player).find((c) => !taken.has(c)) ?? "??";
    taken.add(pick);
    result.set(player.playerId, pick);
  }
  monogramCache.set(players, result);
  return result;
}

// ---------------------------------------------------------------------------
// Label layout
// ---------------------------------------------------------------------------

function squareAround(x: number, y: number, side: number): Box {
  const half = side / 2;
  return { left: x - half, top: y - half, right: x + half, bottom: y + half };
}

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

function labelBox(side: LabelSide, cx: number, cy: number, width: number): Box {
  const reach = TOKEN_RADIUS_PX + LABEL_GAP_PX;
  switch (side) {
    case "below":
      return {
        left: cx - width / 2,
        top: cy + reach,
        right: cx + width / 2,
        bottom: cy + reach + LABEL_HEIGHT_PX,
      };
    case "above":
      return {
        left: cx - width / 2,
        top: cy - reach - LABEL_HEIGHT_PX,
        right: cx + width / 2,
        bottom: cy - reach,
      };
    case "right":
      return {
        left: cx + reach,
        top: cy - LABEL_HEIGHT_PX / 2,
        right: cx + reach + width,
        bottom: cy + LABEL_HEIGHT_PX / 2,
      };
    case "left":
      return {
        left: cx - reach - width,
        top: cy - LABEL_HEIGHT_PX / 2,
        right: cx - reach,
        bottom: cy + LABEL_HEIGHT_PX / 2,
      };
  }
}

/**
 * Chooses a side of its token for each name label, in input order. A side is
 * clean when its box stays on the court (plus a margin) and overlaps no
 * earlier label, no other token, no rim and no `avoid` box; the first clean
 * side of below, above, right, left wins. When none is clean the side with
 * the least weighted overlap wins (labels and avoid boxes count 10x).
 */
export function layoutCourtLabels(input: {
  labels: { playerId: PlayerId; at: { x: number; y: number }; text: string }[];
  tokens: { x: number; y: number }[];
  rims: { x: number; y: number }[];
  avoid?: Box[];
  court: { width: number; height: number };
}): Map<PlayerId, { side: LabelSide; box: Box }> {
  const { width, height } = input.court;
  const bounds: Box = {
    left: -COURT_MARGIN_PX,
    top: -COURT_MARGIN_PX,
    right: width + COURT_MARGIN_PX,
    bottom: height + COURT_MARGIN_PX,
  };
  const tokenBoxes = input.tokens.map((t) => ({
    centre: { x: t.x * width, y: t.y * height },
    box: squareAround(t.x * width, t.y * height, TOKEN_OBSTACLE_PX),
  }));
  const rimBoxes = input.rims.map((r) =>
    squareAround(r.x * width, r.y * height, RIM_OBSTACLE_PX),
  );
  const avoid = input.avoid ?? [];
  const placed: Box[] = [];
  const result = new Map<PlayerId, { side: LabelSide; box: Box }>();

  for (const label of input.labels) {
    const cx = label.at.x * width;
    const cy = label.at.y * height;
    const labelWidth = Math.min(
      LABEL_MAX_WIDTH_PX,
      LABEL_PADDING_PX + LABEL_CHAR_PX * label.text.length,
    );
    const others = tokenBoxes.filter(
      (t) =>
        Math.abs(t.centre.x - cx) > 0.01 || Math.abs(t.centre.y - cy) > 0.01,
    );
    let best: { side: LabelSide; box: Box; cost: number } | null = null;
    for (const side of SIDES) {
      const box = labelBox(side, cx, cy, labelWidth);
      const area = (box.right - box.left) * (box.bottom - box.top);
      const outside = area - overlapArea(box, bounds);
      const labels =
        placed.reduce((sum, p) => sum + overlapArea(box, p), 0) +
        avoid.reduce((sum, p) => sum + overlapArea(box, p), 0);
      const tokens = others.reduce(
        (sum, t) => sum + overlapArea(box, t.box),
        0,
      );
      const rims = rimBoxes.reduce((sum, r) => sum + overlapArea(box, r), 0);
      const cost = labels * 10 + tokens + rims + outside;
      if (cost === 0) {
        best = { side, box, cost };
        break;
      }
      if (best === null || cost < best.cost) {
        best = { side, box, cost };
      }
    }
    const chosen = best!;
    placed.push(chosen.box);
    result.set(label.playerId, { side: chosen.side, box: chosen.box });
  }
  return result;
}
