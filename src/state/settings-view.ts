import type { AiAssistancePhases, GameSettings } from "@/domain/game-settings";
import type { PlayerAttributes } from "@/domain/entities/player";
import type { GameState } from "@/state/game-state";
import { getActiveOwnedFranchise } from "@/state/owner-context";
import {
  leagueSettingsAccessError,
  restrictedFreeAgencyLockReason,
  seasonFormatLockReason,
} from "@/systems/league-settings-edit";

export type SettingsPlayerEditView = {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  potential: number;
  attributes: PlayerAttributes;
};

export type SettingsView = {
  saveId: string;
  settings: GameSettings;
  leagueName: string;
  mode: string;
  liveTeamCount: number;
  controlledTeamLabel: string;
  /** False for non-host members of an online league. */
  canEditLeague: boolean;
  seasonFormatLock: string | null;
  rfaLock: string | null;
  aiAssistance: AiAssistancePhases;
  teams: Array<{ id: string; label: string }>;
  /** Draft class years that exist in the save, ascending. */
  draftYears: number[];
  /** Tools tab: the team picked in the roster editor. */
  selectedTeamId: string | null;
  teamPlayers: Array<{ id: string; label: string }>;
  selectedPlayer: SettingsPlayerEditView | null;
};

/**
 * Settings page payload (Issue #191). Plain data only; the roster editor
 * selection comes from the page's `?team=&player=` params.
 */
export function toSettingsView(
  state: GameState,
  selection: { teamId?: string; playerId?: string } = {},
): SettingsView {
  const teams = Object.values(state.world.teams)
    .map((team) => ({
      id: team.id as string,
      label: `${team.city} ${team.name}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const controlled = state.world.teams[state.user.activeOwnerTeamId];

  const selectedTeamId =
    selection.teamId !== undefined &&
    teams.some((team) => team.id === selection.teamId)
      ? selection.teamId
      : null;
  const teamPlayers =
    selectedTeamId === null
      ? []
      : Object.values(state.world.players)
          .filter(
            (player) => player.teamId === selectedTeamId && !player.retired,
          )
          .sort(
            (a, b) =>
              a.lastName.localeCompare(b.lastName) ||
              a.firstName.localeCompare(b.firstName),
          )
          .map((player) => ({
            id: player.id as string,
            label: `${player.lastName}, ${player.firstName} (${player.position})`,
          }));
  const picked =
    selection.playerId !== undefined
      ? state.world.players[selection.playerId]
      : undefined;
  const selectedPlayer: SettingsPlayerEditView | null =
    picked !== undefined && picked.teamId === selectedTeamId
      ? {
          id: picked.id,
          firstName: picked.firstName,
          lastName: picked.lastName,
          age: picked.age,
          potential: picked.potential.overall,
          attributes: { ...picked.attributes },
        }
      : null;

  return {
    saveId: state.meta.saveId,
    settings: state.settings,
    leagueName: state.world.league.name,
    mode: state.user.mode,
    liveTeamCount: teams.length,
    controlledTeamLabel: controlled
      ? `${controlled.city} ${controlled.name}`
      : "your team",
    canEditLeague: leagueSettingsAccessError(state) === null,
    seasonFormatLock: seasonFormatLockReason(state),
    rfaLock: restrictedFreeAgencyLockReason(state),
    aiAssistance: { ...getActiveOwnedFranchise(state).aiAssistance },
    teams,
    draftYears: Object.values(state.world.drafts)
      .map((draft) => draft.seasonYear)
      .sort((a, b) => a - b),
    selectedTeamId,
    teamPlayers,
    selectedPlayer,
  };
}
