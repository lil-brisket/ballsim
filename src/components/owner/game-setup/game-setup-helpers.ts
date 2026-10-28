import {
  LEAGUE_AREA_LABELS,
  LEAGUE_AREA_OPTIONS,
  type GameSettings,
  type LeagueArea,
} from "@/domain/game-settings";
import type { LeagueSetupPresetId } from "@/domain/game-settings-presets";
import {
  LOCAL_SHARED_LEAGUE_AVAILABLE,
  ONLINE_LEAGUE_AVAILABLE,
  type LocalParticipantSetup,
  type ParticipationMode,
} from "@/domain/participation";
import type { RadioCardOption } from "@/components/owner/game-setup/RadioCardGroup";

export type FormStep = "setup" | "advanced" | "confirm";

export type RosterSourceId = "generated" | "custom";
export type OpeningId = "assigned" | "fantasy";

export const SECTION_IDS = {
  league: "setup-league-format",
  roster: "setup-roster-and-draft",
  save: "setup-save-details",
  participants: "setup-league-participants",
  advanced: "advanced-injuries",
  ai: "advanced-ai",
  history: "advanced-history",
  financial: "advanced-financial",
} as const;

export const ROSTER_SOURCE_OPTIONS: ReadonlyArray<
  RadioCardOption<RosterSourceId>
> = [
  {
    value: "generated",
    title: "Generated rosters",
    description: "The league creates every team's roster for you.",
  },
  {
    value: "custom",
    title: "Imported roster package",
    description:
      "Load a JSON roster package. League size is set by the package's team count.",
  },
];

export const OPENING_OPTIONS: ReadonlyArray<RadioCardOption<OpeningId>> = [
  {
    value: "assigned",
    title: "Assigned team rosters",
    description: "Each team starts with its roster.",
  },
  {
    value: "fantasy",
    title: "Fantasy draft",
    description:
      "All players enter a pool and teams draft from scratch. Draft order, timer and snake/linear format are configured after you choose your franchises.",
  },
];

export type ParticipationOptionId = ParticipationMode | "online";

export function participationOptions(
  signedInAs: string | null,
): ReadonlyArray<RadioCardOption<ParticipationOptionId>> {
  const onlineAvailable = ONLINE_LEAGUE_AVAILABLE && signedInAs !== null;
  return [
    {
      value: "single",
      title: "Single Player",
      description:
        "You manage your franchises; the AI runs every other team. Next you pick your city and teams.",
    },
    {
      value: "local_shared",
      title: "Local Shared League",
      description:
        "Friends share this device, each managing their own franchises and taking turns before the league advances.",
      disabled: !LOCAL_SHARED_LEAGUE_AVAILABLE,
    },
    {
      value: "online",
      title: "Online Multiplayer",
      description:
        "Players join from their own devices with an invite link. You'll be the host.",
      meta: onlineAvailable ? undefined : "Sign in required",
      disabled: !onlineAvailable,
    },
  ];
}

export const PARTICIPATION_LABELS: Record<ParticipationOptionId, string> = {
  single: "Single Player",
  local_shared: "Local Shared League",
  online: "Online Multiplayer",
};

export const PRESET_COPY: Record<
  LeagueSetupPresetId,
  { title: string; text: string }
> = {
  standard: {
    title: "Standard",
    text: "A full-size league with a full-length season.",
  },
  cbl: {
    title: "CBL",
    text: "The classic compact league with a short season.",
  },
  custom: {
    title: "Custom",
    text: "Start from your current settings and edit any rule.",
  },
};

export function defaultParticipants(count: number): LocalParticipantSetup[] {
  return Array.from({ length: count }, (_, index) => ({
    displayName: `Player ${index + 1}`,
    teamCount: 1,
  }));
}

export function teamsLabel(count: number): string {
  return count === 1 ? "1 team" : `${count} teams`;
}

export function leagueNumbers(settings: GameSettings): string {
  return `${settings.league.teamCount} teams · ${settings.regularSeason.gamesPerTeam} games · ${settings.playoffs.playoffTeams} playoff teams · best of ${settings.playoffs.seriesLength}`;
}

export function leagueAreaIndex(area: LeagueArea): number {
  const index = LEAGUE_AREA_OPTIONS.indexOf(area);
  return index >= 0 ? index : 0;
}

export function leagueAreaLabel(area: LeagueArea): string {
  return LEAGUE_AREA_LABELS[area];
}
