/**
 * Pure helpers for new-game onboarding redirects.
 * Fantasy draft routes live outside the dashboard layout to avoid redirect loops.
 */

export type OnboardingRoute =
  | { kind: "city"; path: string }
  | { kind: "franchises"; path: string }
  | { kind: "fantasy_setup"; path: string }
  | { kind: "fantasy_draft"; path: string }
  | { kind: "fantasy_summary"; path: string }
  | { kind: "dashboard"; path: string };

export function resolveOnboardingRoute(
  saveId: string,
  flags: {
    citySelectionConfirmed: boolean;
    franchiseIdentityConfirmed: boolean;
    fantasyDraftMode?: boolean;
    fantasyDraftStatus?: string | null;
  },
): OnboardingRoute {
  if (!flags.citySelectionConfirmed) {
    return { kind: "city", path: `/new/${saveId}/team` };
  }
  if (!flags.franchiseIdentityConfirmed) {
    return { kind: "franchises", path: `/new/${saveId}/franchises` };
  }
  if (flags.fantasyDraftMode) {
    const status = flags.fantasyDraftStatus ?? null;
    if (status === null || status === "setup") {
      return {
        kind: "fantasy_setup",
        path: `/new/${saveId}/fantasy-draft/setup`,
      };
    }
    if (status === "active" || status === "paused") {
      return { kind: "fantasy_draft", path: `/fantasy-draft/${saveId}` };
    }
    if (status === "complete") {
      // Allow dashboard after completion; summary is optional.
      return { kind: "dashboard", path: `/dashboard/${saveId}` };
    }
  }
  return { kind: "dashboard", path: `/dashboard/${saveId}` };
}
