/**
 * Shared BallSim UI surface tokens and density scales.
 * Prefer these over ad-hoc zinc panel classes in new components.
 *
 * Broadcast / arena primitives (team-themed via the `--team-*` CSS variables,
 * see TeamThemeScope): ArenaPanel for hero and primary surfaces, ScoreNumeral
 * for big numbers, TickerBar for label/value strips, TeamBadge for logo plates
 * and SectionHeading for section titles. `panelClass` / `Panel` remain for
 * quiet secondary boxes while pages migrate.
 *
 * Design rules (every screen follows these):
 * - Mono is for numbers in tables, clocks and box scores only. No mono
 *   labels, eyebrows, tabs, buttons or status text.
 * - At most one small uppercase eyebrow per panel, and only above a hero
 *   title. Most labels are sentence case `text-sm text-zinc-400`.
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

export const panelClass = "rounded-xl border border-zinc-800 bg-zinc-900/60";

export const panelDashedClass =
  "rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30";

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
