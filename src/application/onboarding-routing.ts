/**
 * Pure helpers for new-game onboarding redirects.
 */

export type OnboardingRoute =
  | { kind: "city"; path: string }
  | { kind: "franchises"; path: string }
  | { kind: "dashboard"; path: string };

export function resolveOnboardingRoute(
  saveId: string,
  flags: {
    citySelectionConfirmed: boolean;
    franchiseIdentityConfirmed: boolean;
  },
): OnboardingRoute {
  if (!flags.citySelectionConfirmed) {
    return { kind: "city", path: `/new/${saveId}/team` };
  }
  if (!flags.franchiseIdentityConfirmed) {
    return { kind: "franchises", path: `/new/${saveId}/franchises` };
  }
  return { kind: "dashboard", path: `/dashboard/${saveId}` };
}
