/**
 * Shared BallSim UI surface tokens and density scales.
 *
 * Colours come from the tokens in globals.css (`text-ink`, `text-soft`,
 * `text-muted`, `text-faint`, `border-line`, `bg-surface-*`...), never raw
 * `zinc-*` classes; a re-skin is a change of token values.
 *
 * Broadcast / arena primitives (team-themed via the `--team-*` CSS variables,
 * see TeamThemeScope): ArenaPanel for every surface (`quiet` for flat
 * secondary boxes; `panelClass` is its class form), ScoreNumeral for big
 * numbers, TickerBar for label/value strips, TeamBadge for logo plates and
 * SectionHeading for section titles (`size="sm"` for sub-headings).
 *
 * Design rules (every screen follows these):
 * - Mono is for numbers in tables, clocks and box scores only. No mono
 *   labels, eyebrows, tabs, buttons or status text.
 * - Two type voices: the display font (`displayClass`, Barlow Condensed
 *   600–800) for hub names, tab labels, tile titles, OVR and big numbers;
 *   Geist for everything else. Uppercase is allowed in the display font
 *   only.
 * - At most one small uppercase Geist eyebrow per panel, and only above a
 *   hero title. Most labels are sentence case `text-sm text-muted`.
 * - Console shapes: `slantClass` (parallelogram, tabs and name slabs) and
 *   `clipCornerClass` (one cut corner, tiles) shape a background layer only.
 *   Text never rotates or skews.
 * - Focusable tiles, cards and rows use `consoleFocusClass`; it is the
 *   visible focus state (team-ink edge + glow), so do not remove it.
 * - Text floor is `text-sm` for anything a player reads. `text-xs` only for
 *   table footnotes, axis ticks and timestamps.
 * - One heading component: `SectionHeading` (page and section sizes). No
 *   ad-hoc `<h2 className=...>` headings.
 * - At most two surface tiers per screen: one `ArenaPanel` hero; everything
 *   else sits on the page with dividers and spacing. No panels in panels.
 * - Exactly one primary button (solid team colour) per screen region.
 *   Navigation is a link or quiet button, never primary.
 * - Accents use team tokens (`text-team-ink`, `bg-team`, `text-on-team`),
 *   warnings use `warning` tokens. No raw `amber-*` classes.
 * - Dates read like a broadcast ("Oct 8", "Sat, Oct 10"), never ISO strings.
 * - Numbers align: `tabular-nums`, right-aligned numeric columns, signed and
 *   coloured deltas (`+3` win colour, `−2` loss colour).
 * - Say each fact once per screen.
 */

export type Density = "compact" | "default" | "comfortable";

export const focusRingClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink";

/** Inline text link in the team accent. Pair with `focusRingClass`. */
export const linkClass = "text-team-ink underline-offset-4 hover:underline";

/** 44px minimum hit target with a visible press state for iOS (no hover). */
export const touchTargetClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center touch-manipulation active:opacity-80";

/** Text links that still need a 44px-tall tap area. */
export const touchTargetTextClass =
  "inline-flex min-h-11 items-center px-2 touch-manipulation active:opacity-80";

/** Heavy condensed uppercase: hub names, tile titles, OVR, big numbers. */
export const displayClass =
  "font-display font-bold uppercase leading-none tracking-wide";

/**
 * Parallelogram slab behind the content (~8°). Set the fill with
 * `[--slant-fill:var(--team-primary)]` or similar; see `.slant` in
 * globals.css.
 */
export const slantClass = "slant";

/** One cut corner (top right) for a tile's background layers. */
export const clipCornerClass = "clip-corner";

/**
 * Controller-style focus: scale 1.03, team-ink edge, team glow, raised
 * surface; static (edge + glow only) under reduced motion. Shaped hosts add
 * `data-shape` and paint their edge from `var(--edge)` and surface from
 * `var(--tile-surface)`.
 */
export const consoleFocusClass = "console-focus";

export const panelClass = "rounded-xl border border-line bg-surface-raised/60";

export const panelDashedClass =
  "rounded-xl border border-dashed border-line bg-surface-raised/30";

export const densityPadding: Record<Density, string> = {
  compact: "p-3",
  default: "p-4",
  comfortable: "p-5",
};

export const densityGap: Record<Density, string> = {
  compact: "gap-2",
  default: "gap-3",
  comfortable: "gap-4",
};

export const densitySectionSpace: Record<Density, string> = {
  compact: "space-y-2",
  default: "space-y-3",
  comfortable: "space-y-4",
};

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
