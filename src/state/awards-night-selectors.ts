/**
 * Awards night: the yearly major awards, smallest to biggest. Built only from
 * stored AwardResults; the game records no vote shares, all-league teams or
 * Finals MVP, so none are shown.
 */

import type {
  AwardCandidateResult,
  AwardDefinitionId,
  AwardResult,
} from "@/domain/entities/awards";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { getPlayerIdentity } from "@/state/player-identity";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { AWARD_DEFINITIONS } from "@/systems/awards/award-definitions";

export type AwardsNightFinalist = {
  subjectId: string;
  subjectType: "player" | "coach";
  name: string;
  teamId: string | null;
  teamAbbreviation: string | null;
  /** "1", "2", or "T-2" when another candidate shares the rank. */
  rankLabel: string;
  isUserTeam: boolean;
};

export type AwardsNightAward = {
  awardId: string;
  displayName: string;
  subjectType: "player" | "coach";
  /** Top 3 by rank, then subject id. */
  finalists: AwardsNightFinalist[];
  winner: AwardsNightFinalist & {
    portrait: PlayerPortraitAssignment | null;
    teamName: string | null;
    statLine: string;
    /** The winner's score equals the next candidate's. */
    tieBreak: boolean;
  };
  userWon: boolean;
};

export type AwardsNightView = {
  seasonYear: number;
  awards: AwardsNightAward[];
  userWinners: number;
  isCurrent: boolean;
};

/** Smallest to biggest; MVP is the finale. */
const AWARDS_NIGHT_ORDER: readonly AwardDefinitionId[] = [
  "coach_of_year",
  "most_improved",
  "sixth_man",
  "roy",
  "dpoy",
  "mvp",
];

const CURRENT_PHASES: ReadonlySet<string> = new Set([
  "playoffs",
  "postseason",
  "offseason",
]);

function isYearlyMajor(result: AwardResult): boolean {
  const def = AWARD_DEFINITIONS[result.awardId];
  return (
    def !== undefined &&
    def.tier === "major" &&
    def.cadence === "yearly" &&
    result.cadence === "yearly" &&
    AWARDS_NIGHT_ORDER.includes(result.awardId)
  );
}

function oneDecimal(value: number): string {
  return value.toFixed(1);
}

function statLine(result: AwardResult): string {
  const snapshot = result.context?.statSnapshot;
  if (!snapshot) return "";
  if (result.winner.subjectType === "coach") {
    const record = snapshot.teamRecord;
    return record ? `${record.wins}–${record.losses}` : "";
  }
  const rates = snapshot.perGame;
  if (!rates) return "";
  const line =
    result.awardId === "dpoy"
      ? `${oneDecimal(rates.steals)} STL · ${oneDecimal(rates.blocks)} BLK · ${oneDecimal(rates.rebounds)} REB`
      : `${oneDecimal(rates.points)} PTS · ${oneDecimal(rates.rebounds)} REB · ${oneDecimal(rates.assists)} AST`;
  return `${snapshot.games} GP · ${line}`;
}

function toFinalist(
  state: GameState,
  result: AwardResult,
  candidate: AwardCandidateResult,
  userTeamId: string,
  tiedRanks: ReadonlySet<number>,
): AwardsNightFinalist {
  const subjectType = AWARD_DEFINITIONS[result.awardId].subjectType;
  let name: string = candidate.subjectId;
  if (subjectType === "coach") {
    const coach = state.world.coaches[candidate.subjectId];
    if (coach) name = `${coach.firstName} ${coach.lastName}`;
  } else {
    name =
      getPlayerIdentity(state, candidate.subjectId)?.displayName ??
      candidate.subjectId;
  }
  const team = candidate.teamId ? state.world.teams[candidate.teamId] : null;
  return {
    subjectId: candidate.subjectId,
    subjectType,
    name,
    teamId: candidate.teamId,
    teamAbbreviation: team?.abbreviation ?? null,
    rankLabel: tiedRanks.has(candidate.rank)
      ? `T-${candidate.rank}`
      : String(candidate.rank),
    isUserTeam: candidate.teamId !== null && candidate.teamId === userTeamId,
  };
}

function toAward(
  state: GameState,
  result: AwardResult,
  userTeamId: string,
): AwardsNightAward {
  const def = AWARD_DEFINITIONS[result.awardId];
  const counts = new Map<number, number>();
  for (const c of result.candidates) {
    counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  }
  const tiedRanks = new Set(
    [...counts].filter(([, n]) => n > 1).map(([rank]) => rank),
  );
  const sorted = [...result.candidates].sort(
    (a, b) =>
      a.rank - b.rank ||
      (a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : 0),
  );
  const finalists = sorted
    .slice(0, 3)
    .map((c) => toFinalist(state, result, c, userTeamId, tiedRanks));

  const winnerCandidate: AwardCandidateResult = result.candidates.find(
    (c) => c.subjectId === result.winner.subjectId,
  ) ?? {
    subjectId: result.winner.subjectId,
    teamId: result.winner.teamId,
    rank: 1,
    score: result.context?.winnerScore ?? 0,
  };
  const winnerBase = toFinalist(
    state,
    result,
    { ...winnerCandidate, teamId: result.winner.teamId },
    userTeamId,
    tiedRanks,
  );
  const next = sorted.find((c) => c.subjectId !== winnerCandidate.subjectId);
  const team = result.winner.teamId
    ? state.world.teams[result.winner.teamId]
    : null;
  return {
    awardId: result.awardId,
    displayName: def.displayName,
    subjectType: def.subjectType,
    finalists,
    winner: {
      ...winnerBase,
      portrait:
        def.subjectType === "player"
          ? selectPlayerPortrait(state, result.winner.subjectId)
          : null,
      teamName: team ? `${team.city} ${team.name}` : null,
      statLine: statLine(result),
      tieBreak: next !== undefined && next.score === winnerCandidate.score,
    },
    userWon: winnerBase.isUserTeam,
  };
}

/** Null when the season (default: latest with awards) has no major awards. */
export function toAwardsNightView(
  state: GameState,
  seasonYear?: number,
): AwardsNightView | null {
  const results = Object.values(state.business.awards.results).filter(
    isYearlyMajor,
  );
  if (results.length === 0) return null;
  const year =
    seasonYear ?? Math.max(...results.map((result) => result.seasonYear));
  const ofYear = results.filter((result) => result.seasonYear === year);
  if (ofYear.length === 0) return null;

  const userTeamId = getActiveOwnerTeamId(state);
  const awards = AWARDS_NIGHT_ORDER.flatMap((awardId) => {
    const result = ofYear.find((r) => r.awardId === awardId);
    return result ? [toAward(state, result, userTeamId)] : [];
  });
  const season = state.competition.season;
  return {
    seasonYear: year,
    awards,
    userWinners: awards.filter((award) => award.userWon).length,
    isCurrent: year === season.year && CURRENT_PHASES.has(season.phase),
  };
}
