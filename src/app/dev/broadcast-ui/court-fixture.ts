/**
 * Dev-only fixture for the court replay QA section: a short fictional game
 * covering a made three with an assist, a block and defensive rebound, a
 * steal, a personal foul, a shooting foul with two free throws, an offensive
 * rebound, an offensive foul and a substitution. Home is the very dark team,
 * away the very light one (same colours as the rest of the dev page).
 */
import { asGameId, asPlayerId, asTeamId } from "@/domain/ids";
import type {
  ShotLine,
  WatchGameView,
  WatchPlay,
  WatchPlayKind,
  WatchPlayer,
  WatchSide,
  WatchTeam,
} from "@/state/watch-game-view";

export const COURT_HOME: WatchTeam = {
  teamId: asTeamId("dev_home"),
  side: 0,
  city: "Harbor",
  name: "Harriers",
  abbreviation: "HAR",
  branding: {
    primaryColor: "#0B1F3A",
    secondaryColor: "#C4CED4",
    accentColor: "#F5B800",
    logoId: "wolf",
  },
  hasBranding: true,
};

export const COURT_AWAY: WatchTeam = {
  teamId: asTeamId("dev_away"),
  side: 1,
  city: "Summit",
  name: "Glaciers",
  abbreviation: "SUM",
  branding: {
    primaryColor: "#F2F0E6",
    secondaryColor: "#1D6B44",
    accentColor: "#C8102E",
    logoId: "eagle",
  },
  hasBranding: true,
};

const ROSTER: Array<[string, WatchSide, string, string, boolean]> = [
  ["h1", 0, "Jalen", "Smith", true],
  ["h2", 0, "Kai", "Lee", true],
  ["h3", 0, "Marco", "Ortiz", true],
  ["h4", 0, "Dre", "Brooks", true],
  ["h5", 0, "Tom", "Nguyen", true],
  ["h6", 0, "Sam", "Park", false],
  ["a1", 1, "Mike", "Jones", true],
  ["a2", 1, "Tyrese", "Reed", true],
  ["a3", 1, "Ian", "Cole", true],
  ["a4", 1, "Leo", "Webb", true],
  ["a5", 1, "Omar", "Diaz", true],
  ["a6", 1, "Ben", "Hale", false],
];

const PLAYERS: WatchPlayer[] = ROSTER.map(
  ([id, side, first, last, started]) => ({
    playerId: asPlayerId(id),
    side,
    fullName: `${first} ${last}`,
    shortName: `${first[0]}. ${last}`,
    lastName: last,
    position: null,
    started,
    finalMinutes: started ? 30 : 12,
  }),
);

type Step = [
  kind: WatchPlayKind,
  side: WatchSide,
  player: string,
  player2: string | null,
  points: number,
  poss: number,
];

const STEPS: Step[] = [
  ["three_made", 0, "h1", "h2", 3, 1],
  ["two_missed", 1, "a1", "h3", 0, 2],
  ["defensive_rebound", 0, "h4", null, 0, 2],
  ["turnover", 0, "h1", "a2", 0, 3],
  ["two_made", 1, "a2", "a1", 2, 4],
  ["personal_foul", 0, "h3", "a1", 0, 5],
  ["three_missed", 1, "a3", null, 0, 5],
  ["offensive_rebound", 1, "a4", null, 0, 5],
  ["two_made", 1, "a4", null, 2, 5],
  ["turnover", 0, "h2", null, 0, 6],
  ["shooting_foul", 1, "a5", "h1", 0, 7],
  ["ft_made", 0, "h1", null, 1, 7],
  ["ft_missed", 0, "h1", null, 0, 7],
  ["defensive_rebound", 1, "a1", null, 0, 7],
  ["offensive_foul", 1, "a2", null, 0, 8],
  ["substitution", 0, "h2", "h6", 0, 9],
  ["three_made", 0, "h6", "h1", 3, 9],
];

function buildPlays(): WatchPlay[] {
  const nameOf = new Map(PLAYERS.map((p) => [p.playerId as string, p]));
  const short = (id: string | null) =>
    id === null ? "" : (nameOf.get(id)?.shortName ?? id);
  let home = 0;
  let away = 0;
  return STEPS.map(([kind, side, player, player2, points, poss], index) => {
    if (side === 0) {
      home += points;
    } else {
      away += points;
    }
    const clock = 700 - index * 30;
    const seconds = String(clock % 60).padStart(2, "0");
    return {
      index,
      period: 1,
      periodLabel: "Q1",
      clock,
      clockLabel: `${Math.floor(clock / 60)}:${seconds}`,
      poss,
      kind,
      side,
      playerId: asPlayerId(player),
      player2Id: player2 === null ? null : asPlayerId(player2),
      text: `${short(player)} ${kind.replace(/_/g, " ")}${
        player2 ? ` (${short(player2)})` : ""
      }`,
      points,
      homeScore: home,
      awayScore: away,
      highlights: [],
    };
  });
}

const EMPTY_LINE: ShotLine = {
  points: 0,
  fgm: 0,
  fga: 0,
  twoPm: 0,
  twoPa: 0,
  threePm: 0,
  threePa: 0,
  ftm: 0,
  fta: 0,
  assistedFgm: 0,
};

const PLAYS = buildPlays();
const LAST = PLAYS[PLAYS.length - 1]!;

export const COURT_FIXTURE_VIEW: WatchGameView = {
  gameId: asGameId("dev_court_game"),
  date: "2026-10-17",
  competitionType: "regular_season",
  home: COURT_HOME,
  away: COURT_AWAY,
  finalScore: { home: LAST.homeScore, away: LAST.awayScore },
  periodScores: [{ home: LAST.homeScore, away: LAST.awayScore }],
  players: PLAYERS,
  plays: PLAYS,
  keyMoments: [],
  shotSummary: {
    home: { total: EMPTY_LINE, byPeriod: [EMPTY_LINE] },
    away: { total: EMPTY_LINE, byPeriod: [EMPTY_LINE] },
    players: [],
  },
  injuries: [],
};
