/**
 * Shared nickname normalization and validation for franchise naming.
 * City and nickname remain independent; display name is `${city} ${nickname}`.
 */

export const TEAM_NICKNAME_MAX_LENGTH = 24;

const ALLOWED_NICKNAME = /^[A-Za-z0-9](?:[A-Za-z0-9' -]*[A-Za-z0-9])?$/;

export type TeamNicknameIdentity = {
  id: string;
  city: string;
  name: string;
};

export type ValidateTeamNicknameContext = {
  city?: string;
  existingTeams?: readonly TeamNicknameIdentity[];
  excludeTeamId?: string;
};

export type TeamNicknameValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function normalizeTeamNickname(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

export function validateTeamNickname(
  input: string,
  context: ValidateTeamNicknameContext = {},
): TeamNicknameValidation {
  const value = normalizeTeamNickname(input);
  if (value.length === 0) {
    return { ok: false, error: "Team name cannot be empty." };
  }
  if (value.length > TEAM_NICKNAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Team name must be ${TEAM_NICKNAME_MAX_LENGTH} characters or fewer.`,
    };
  }
  if (!ALLOWED_NICKNAME.test(value)) {
    return {
      ok: false,
      error:
        "Team name may use letters, numbers, spaces, hyphens, and apostrophes.",
    };
  }

  const city = context.city?.trim();
  if (city && context.existingTeams) {
    const cityKey = city.toLowerCase();
    const nameKey = value.toLowerCase();
    const conflict = context.existingTeams.find((team) => {
      if (context.excludeTeamId && team.id === context.excludeTeamId) {
        return false;
      }
      return (
        team.city.toLowerCase() === cityKey &&
        team.name.toLowerCase() === nameKey
      );
    });
    if (conflict) {
      return {
        ok: false,
        error: `${city} ${value} is already used in this league.`,
      };
    }
  }

  return { ok: true, value };
}

export function nextNicknameFromPool(
  current: string,
  pool: readonly string[],
  usedNicknames: readonly string[] = [],
): string | null {
  if (pool.length === 0) {
    return null;
  }
  const used = new Set(usedNicknames.map((name) => name.toLowerCase()));
  const currentKey = current.toLowerCase();
  const start = pool.findIndex((name) => name.toLowerCase() === currentKey);
  const from = start >= 0 ? start + 1 : 0;
  for (let offset = 0; offset < pool.length; offset += 1) {
    const candidate = pool[(from + offset) % pool.length]!;
    const key = candidate.toLowerCase();
    if (key === currentKey) {
      continue;
    }
    if (used.has(key)) {
      continue;
    }
    return candidate;
  }
  return null;
}
