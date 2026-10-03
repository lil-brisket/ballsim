/**
 * Shared BallSim UI surface tokens and density scales.
 * Prefer these over ad-hoc zinc panel classes in new components.
 */

export type Density = "compact" | "default" | "comfortable";

export const focusRingClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500";

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
