import type { GameState } from "@/state/game-state";
import { playoffRoundLabel } from "@/domain/entities/playoffs";

export type MidseasonCupHubView = {
  saveId: string;
  status: string;
  format: string | null;
  startDate: string | null;
  endDate: string | null;
  championTeamId: string | null;
  championName: string | null;
  fieldSize: number;
  rounds: Array<{
    round: number;
    label: string;
    series: Array<{
      id: string;
      higherName: string;
      lowerName: string;
      winnerName: string | null;
      status: string;
    }>;
  }>;
};

export function toMidseasonCupHubView(state: GameState): MidseasonCupHubView {
  const tournament = state.competition.seasonEvents?.tournament ?? null;
  if (!tournament) {
    return {
      saveId: state.meta.saveId,
      status: "none",
      format: null,
      startDate: null,
      endDate: null,
      championTeamId: null,
      championName: null,
      fieldSize: 0,
      rounds: [],
    };
  }

  const teamName = (id: string | null | undefined): string => {
    if (!id) return "TBD";
    const team = state.world.teams[id];
    return team ? `${team.city} ${team.name}` : id;
  };

  const byRound = new Map<number, typeof tournament.series>();
  for (const series of tournament.series) {
    const list = byRound.get(series.round) ?? [];
    list.push(series);
    byRound.set(series.round, list);
  }

  const rounds = [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, seriesList]) => ({
      round,
      label:
        tournament.fieldSize >= 2
          ? playoffRoundLabel(round, tournament.fieldSize)
          : `round_${round}`,
      series: seriesList
        .sort((a, b) => a.slot - b.slot)
        .map((s) => ({
          id: s.id,
          higherName: teamName(s.higherSeedTeamId),
          lowerName: teamName(s.lowerSeedTeamId),
          winnerName: s.winnerTeamId ? teamName(s.winnerTeamId) : null,
          status: s.status,
        })),
    }));

  return {
    saveId: state.meta.saveId,
    status: tournament.status,
    format: tournament.format,
    startDate: tournament.startDate,
    endDate: tournament.endDate,
    championTeamId: tournament.championTeamId ?? null,
    championName: tournament.championTeamId
      ? teamName(tournament.championTeamId)
      : null,
    fieldSize: tournament.fieldSize,
    rounds,
  };
}
