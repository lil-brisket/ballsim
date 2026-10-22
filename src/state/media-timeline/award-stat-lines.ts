/**
 * The three numbers each award card shows. Each award gets the numbers that
 * explain why it was won (steals and blocks for defense, minutes off the bench
 * for the sixth man), not one fixed points/rebounds/assists line.
 */

import type {
  AwardDefinitionId,
  AwardStatSnapshot,
} from "@/domain/entities/awards";
import type { GameState } from "@/state/game-state";
import type { AwardStat } from "./types";

const oneDecimal = (value: number) => value.toFixed(1);

/** "+6.2", "−3.0", "0.0" (the minus is U+2212, matching the en-dash records). */
function signed(value: number, digits: number): string {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return text;
  return value > 0 ? `+${text}` : `−${text}`;
}

function signedTone(value: number): AwardStat["tone"] {
  if (value > 0) return "win";
  if (value < 0) return "loss";
  return undefined;
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** Points per game in the season before `seasonYear`, or null without one. */
export function priorSeasonPointsPerGame(
  state: GameState,
  playerId: string,
  seasonYear: number,
): number | null {
  const prior = state.business.playerHistory[playerId]?.seasons.find(
    (season) => season.seasonYear === seasonYear - 1,
  );
  const line = prior?.competition.regular;
  return line && line.games > 0 ? line.points / line.games : null;
}

/** Wins in the season before `seasonYear`, or null without one. */
export function priorSeasonWins(
  state: GameState,
  teamId: string,
  seasonYear: number,
): number | null {
  const prior = state.business.franchiseHistory[teamId]?.seasons.find(
    (season) => season.seasonYear === seasonYear - 1,
  );
  return prior ? prior.wins : null;
}

export type AwardStatInput = {
  awardId: AwardDefinitionId;
  snapshot: AwardStatSnapshot;
  isPlayer: boolean;
  /** Most Improved only. */
  priorPointsPerGame: number | null;
  /** Coach of the Year only. */
  priorWins: number | null;
};

export type AwardStatResult = {
  stats: AwardStat[];
  /** Signed change on last season (MIP points per game, COY wins), when known. */
  improvement: number | null;
};

export function awardStatLine(input: AwardStatInput): AwardStatResult {
  const { snapshot: s } = input;
  const pg = s.perGame;
  const scoring: AwardStat[] = [
    { label: "PPG", value: oneDecimal(pg.points) },
    { label: "RPG", value: oneDecimal(pg.rebounds) },
    { label: "APG", value: oneDecimal(pg.assists) },
  ];

  if (!input.isPlayer) {
    const record: AwardStat = {
      label: "Record",
      value: `${s.teamRecord.wins}–${s.teamRecord.losses}`,
    };
    const rank: AwardStat[] =
      s.teamRank !== null
        ? [{ label: "League rank", value: ordinal(s.teamRank) }]
        : [];
    if (input.priorWins === null) {
      return { stats: [record, ...rank], improvement: null };
    }
    const change = s.teamRecord.wins - input.priorWins;
    return {
      stats: [
        record,
        {
          label: "Wins vs last season",
          value: signed(change, 0),
          tone: signedTone(change),
        },
        ...rank,
      ],
      improvement: change,
    };
  }

  switch (input.awardId) {
    case "dpoy":
    case "defensive_player_of_month":
      // Rebounds are stored as one total; there is no defensive split.
      return {
        stats: [
          { label: "SPG", value: oneDecimal(pg.steals) },
          { label: "BPG", value: oneDecimal(pg.blocks) },
          { label: "RPG", value: oneDecimal(pg.rebounds) },
        ],
        improvement: null,
      };
    case "sixth_man":
      return {
        stats: [
          { label: "PPG", value: oneDecimal(pg.points) },
          { label: "MPG", value: oneDecimal(pg.minutes) },
          { label: "RPG", value: oneDecimal(pg.rebounds) },
        ],
        improvement: null,
      };
    case "most_improved": {
      if (input.priorPointsPerGame === null) {
        return { stats: scoring, improvement: null };
      }
      // Subtract the shown values so the three numbers add up on the card.
      const now = oneDecimal(pg.points);
      const before = oneDecimal(input.priorPointsPerGame);
      const change = Number(now) - Number(before);
      return {
        stats: [
          { label: "PPG", value: now },
          { label: "Last season", value: before },
          {
            label: "Change",
            value: signed(change, 1),
            tone: signedTone(change),
          },
        ],
        improvement: change,
      };
    }
    default:
      return { stats: scoring, improvement: null };
  }
}
