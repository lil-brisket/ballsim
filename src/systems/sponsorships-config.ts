/**
 * Named tuning constants for monthly sponsorship payout modifiers.
 * Initial ranges are starting points — not design truths.
 * Inspect for runaway sponsorship / marketing-dominant loops before raising.
 */

/** Media attention 0 → this factor; 100 → SPONSORSHIP_MEDIA_FACTOR_MAX. */
export const SPONSORSHIP_MEDIA_FACTOR_MIN = 0.85;
export const SPONSORSHIP_MEDIA_FACTOR_MAX = 1.25;

/** League sponsorshipClimate 0 → this factor; 100 → SPONSORSHIP_CLIMATE_FACTOR_MAX. */
export const SPONSORSHIP_CLIMATE_FACTOR_MIN = 0.85;
export const SPONSORSHIP_CLIMATE_FACTOR_MAX = 1.25;

/** Dollars of annual deal value per point of media attention (AI signing). */
export const AI_SPONSOR_MEDIA_VALUE_PER_POINT = 8_000;

export function sponsorshipMediaFactor(mediaAttention: number): number {
  const clamped = Math.max(0, Math.min(100, mediaAttention));
  return (
    SPONSORSHIP_MEDIA_FACTOR_MIN +
    (clamped / 100) *
      (SPONSORSHIP_MEDIA_FACTOR_MAX - SPONSORSHIP_MEDIA_FACTOR_MIN)
  );
}

export function sponsorshipClimateFactor(sponsorshipClimate: number): number {
  const clamped = Math.max(0, Math.min(100, sponsorshipClimate));
  return (
    SPONSORSHIP_CLIMATE_FACTOR_MIN +
    (clamped / 100) *
      (SPONSORSHIP_CLIMATE_FACTOR_MAX - SPONSORSHIP_CLIMATE_FACTOR_MIN)
  );
}
