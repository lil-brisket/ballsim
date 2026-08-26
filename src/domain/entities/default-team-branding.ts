/**
 * Deterministic default branding for tests and bootstrap helpers.
 */

import { brandingFromPalette } from "@/domain/entities/team-branding";
import type { TeamBranding } from "@/domain/entities/team-branding";

/** Stable test/bootstrap default — Midnight Navy + Shield. */
export const DEFAULT_TEST_TEAM_BRANDING: TeamBranding = brandingFromPalette(
  "midnight_navy",
  "shield",
);
