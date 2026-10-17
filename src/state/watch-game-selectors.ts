/**
 * Watch Game selectors: decode the stored play-by-play log
 * (competition.playByPlay) into the view-model in watch-game-view.ts.
 * Pure — no simulation logic, only decoding and tallying the recorded plays.
 */
import type { Game } from "@/domain/entities/game";
import {
  PLAY_CODE,
  isFoulCode,
  playCodePoints,
  type PlayByPlayLog,
} from "@/domain/entities/play-by-play";
import { TEAM_LOGO_IDS } from "@/data/team-branding/logo-catalog";
import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { canOpenGameBoxScore, resolveTeamIdentity } from "@/state/selectors";
import type { TeamBrandingView } from "@/state/team-branding-view";
import type {
  KeyMoment,
  LiveBoxScore,
  LiveBoxScoreRow,
  LiveTeamBox,
  PostGameInjury,
  ShotLine,
  ShotSummary,
  TeamShotSummary,
  WatchGameView,
  WatchHighlight,
  WatchPlay,
  WatchPlayer,
  WatchPlayKind,
  WatchSide,
  WatchTeam,
} from "@/state/watch-game-view";

const FOUL_OUT_FOULS = 6;
const RUN_THRESHOLD = 8;
const CLUTCH_CLOCK_SECONDS = 300;
const CLUTCH_MARGIN = 5;
const CLUTCH_MIN_PERIOD = 4;
const REGULATION_PERIODS = 4;
/** Clock shown before the first play (seconds in a regulation period). */
export const START_PERIOD_CLOCK_SECONDS = 720;

const KIND_BY_CODE: Record<number, WatchPlayKind> = {
  [PLAY_CODE.twoMade]: "two_made",
  [PLAY_CODE.twoMissed]: "two_missed",
  [PLAY_CODE.threeMade]: "three_made",
  [PLAY_CODE.threeMissed]: "three_missed",
  [PLAY_CODE.freeThrowMade]: "ft_made",
  [PLAY_CODE.freeThrowMissed]: "ft_missed",
  [PLAY_CODE.offensiveRebound]: "offensive_rebound",
  [PLAY_CODE.defensiveRebound]: "defensive_rebound",
  [PLAY_CODE.turnover]: "turnover",
  [PLAY_CODE.shootingFoul]: "shooting_foul",
  [PLAY_CODE.personalFoul]: "personal_foul",
  [PLAY_CODE.offensiveFoul]: "offensive_foul",
  [PLAY_CODE.substitution]: "substitution",
};

const MOMENT_KIND_ORDER: Record<KeyMoment["kind"], number> = {
  lead_change: 0,
  tie: 1,
  run: 2,
  clutch: 3,
  foul_out: 4,
  injury: 5,
};

const FALLBACK_BRANDING: TeamBrandingView = {
  primaryColor: "#334155",
  secondaryColor: "#94a3b8",
  accentColor: "#f1f5f9",
  logoId: TEAM_LOGO_IDS[0]!,
};

/** "m:ss" game clock, e.g. 720 -> "12:00", 7 -> "0:07". */
export function formatGameClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

/** "Q1".."Q4", then "OT", "2OT", "3OT", ... */
export function periodLabel(period: number): string {
  if (period <= REGULATION_PERIODS) {
    return `Q${Math.max(1, period)}`;
  }
  const overtime = period - REGULATION_PERIODS;
  return overtime === 1 ? "OT" : `${overtime}OT`;
}

/** True when the game is a finished current-season game with a recorded log. */
export function canWatchGame(state: GameState, gameId: string): boolean {
  return (
    canOpenGameBoxScore(state, gameId) &&
    state.competition.playByPlay[gameId] != null
  );
}

export function toWatchGameView(
  state: GameState,
  gameId: string,
): WatchGameView | null {
  if (!canWatchGame(state, gameId)) {
    return null;
  }
  const game = state.competition.games[gameId]!;
  const log = state.competition.playByPlay[gameId]!;

  const home = toWatchTeam(state, game, 0);
  const away = toWatchTeam(state, game, 1);
  const players = toWatchPlayers(state, game);
  const names = new Map<PlayerId, Names>();
  for (const player of players) {
    names.set(player.playerId, {
      full: player.fullName,
      short: player.shortName,
      last: player.lastName,
    });
  }
  const nameOf = (id: PlayerId): Names => {
    const known = names.get(id);
    if (known) {
      return known;
    }
    const live = state.world.players[id];
    const resolved = live
      ? formatNames(live.firstName, live.lastName)
      : idNames(id);
    names.set(id, resolved);
    return resolved;
  };

  const { plays, keyMoments } = decodePlays(log, nameOf, home, away);

  const injuries = toPostGameInjuries(state, game, players);
  for (const injury of injuries) {
    keyMoments.push({
      kind: "injury",
      playIndex: null,
      periodLabel: null,
      clockLabel: null,
      side: injury.side,
      title: `${injury.shortName} injured`,
      detail: injury.description,
    });
  }

  const view: WatchGameView = {
    gameId: game.id,
    date: game.date,
    competitionType: game.competitionType,
    home,
    away,
    finalScore: { home: game.score.home, away: game.score.away },
    periodScores: game.periodScores.map((p) => ({
      home: p.home,
      away: p.away,
    })),
    players,
    plays,
    keyMoments,
    shotSummary: EMPTY_SHOT_SUMMARY(),
    injuries,
  };
  view.shotSummary = buildShotSummary(view);
  return view;
}

function toWatchTeam(state: GameState, game: Game, side: WatchSide): WatchTeam {
  const teamId = side === 0 ? game.homeTeamId : game.awayTeamId;
  const snapshot = side === 0 ? game.homeTeamSnapshot : game.awayTeamSnapshot;
  const identity = resolveTeamIdentity(
    snapshot,
    state.world.teams[teamId],
    teamId,
  );
  return {
    teamId,
    side,
    city: identity.city,
    name: identity.name,
    abbreviation: identity.abbreviation,
    branding: identity.branding ?? FALLBACK_BRANDING,
  };
}

function formatNames(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): Names {
  const first = firstName ?? "";
  const last = lastName ?? "";
  const initial = first.length > 0 ? `${first.charAt(0)}. ` : "";
  const short = `${initial}${last}`.trim();
  return {
    full: `${first} ${last}`.trim(),
    short,
    last: last.trim() || short,
  };
}

function idNames(id: PlayerId): Names {
  return { full: id as string, short: id as string, last: id as string };
}

function toWatchPlayers(state: GameState, game: Game): WatchPlayer[] {
  const players: WatchPlayer[] = [];
  for (const row of game.playerStats) {
    const side: WatchSide | null =
      row.teamId === game.homeTeamId
        ? 0
        : row.teamId === game.awayTeamId
          ? 1
          : null;
    if (side === null) {
      continue;
    }
    const live = state.world.players[row.playerId];
    const names =
      row.firstName != null && row.lastName != null
        ? formatNames(row.firstName, row.lastName)
        : live
          ? formatNames(live.firstName, live.lastName)
          : idNames(row.playerId);
    players.push({
      playerId: row.playerId,
      side,
      fullName: names.full,
      shortName: names.short,
      lastName: names.last,
      position: live?.position ?? null,
      started: row.started,
      finalMinutes: row.minutes,
    });
  }
  // Home first, then away; stable within each side.
  return [
    ...players.filter((p) => p.side === 0),
    ...players.filter((p) => p.side === 1),
  ];
}

function toPostGameInjuries(
  state: GameState,
  game: Game,
  players: WatchPlayer[],
): PostGameInjury[] {
  const result: PostGameInjury[] = [];
  for (const watchPlayer of players) {
    const player = state.world.players[watchPlayer.playerId];
    if (!player) {
      continue;
    }
    const seen = new Set<string>();
    const entries = [...player.activeInjuries, ...player.injuryHistory];
    for (const entry of entries) {
      if (
        entry.injuredOn !== game.date ||
        (entry.exposureSource !== "game_acute" &&
          entry.exposureSource !== "game_overuse") ||
        seen.has(entry.injuryId)
      ) {
        continue;
      }
      seen.add(entry.injuryId);
      const type = entry.type.charAt(0).toUpperCase() + entry.type.slice(1);
      result.push({
        playerId: watchPlayer.playerId,
        side: watchPlayer.side,
        shortName: watchPlayer.shortName,
        description: `${type} (${entry.severity})`,
      });
    }
  }
  return result;
}

type Names = { full: string; short: string; last: string };

function playText(
  kind: WatchPlayKind,
  s: string,
  p2: string | null,
  foulsOut: boolean,
): string {
  let text: string;
  switch (kind) {
    case "two_made":
      text = `${s} makes 2-pt shot${p2 ? ` (${p2} assists)` : ""}`;
      break;
    case "three_made":
      text = `${s} makes 3-pt shot${p2 ? ` (${p2} assists)` : ""}`;
      break;
    case "two_missed":
      text = `${s} misses 2-pt shot${p2 ? ` (blocked by ${p2})` : ""}`;
      break;
    case "three_missed":
      text = `${s} misses 3-pt shot${p2 ? ` (blocked by ${p2})` : ""}`;
      break;
    case "ft_made":
      text = `${s} makes free throw`;
      break;
    case "ft_missed":
      text = `${s} misses free throw`;
      break;
    case "offensive_rebound":
      text = `${s} offensive rebound`;
      break;
    case "defensive_rebound":
      text = `${s} defensive rebound`;
      break;
    case "turnover":
      text = `${s} turnover${p2 ? ` (${p2} steals)` : ""}`;
      break;
    case "shooting_foul":
      text = `Shooting foul on ${s} (${p2 ?? "?"} fouled)`;
      break;
    case "personal_foul":
      text = `Personal foul on ${s}`;
      break;
    case "offensive_foul":
      text = `Offensive foul on ${s}`;
      break;
    case "substitution":
      text = `${p2 ?? "?"} checks in for ${s}`;
      break;
  }
  return foulsOut ? `${text} — fouls out` : text;
}

function scoringTitle(prefix: "Go-ahead" | "Tying", kind: WatchPlayKind) {
  if (kind === "ft_made") {
    return `${prefix} free throw`;
  }
  return `${prefix} ${kind === "three_made" ? "3" : "2"}`;
}

function decodePlays(
  log: PlayByPlayLog,
  nameOf: (id: PlayerId) => Names,
  home: WatchTeam,
  away: WatchTeam,
): { plays: WatchPlay[]; keyMoments: KeyMoment[] } {
  const plays: WatchPlay[] = [];
  const moments: Array<KeyMoment & { order: number }> = [];
  const abbr = (side: WatchSide) =>
    side === 0 ? home.abbreviation : away.abbreviation;
  const scoreLabel = (h: number, a: number) => `${h}-${a}`;

  let homeScore = 0;
  let awayScore = 0;
  let leader: WatchSide | null = null;
  const fouls = new Map<PlayerId, number>();
  let run: {
    side: WatchSide;
    points: number;
    reachedAt: number | null;
  } | null = null;

  const closeRun = (h: number, a: number) => {
    if (run && run.reachedAt !== null) {
      const at = plays[run.reachedAt]!;
      moments.push({
        order: run.reachedAt,
        kind: "run",
        playIndex: run.reachedAt,
        periodLabel: at.periodLabel,
        clockLabel: at.clockLabel,
        side: run.side,
        title: `${run.points}-0 run`,
        detail: `${abbr(run.side)} run; score ${scoreLabel(h, a)}`,
      });
    }
  };

  const count = log.code.length;
  for (let i = 0; i < count; i += 1) {
    const code = log.code[i]!;
    const kind = KIND_BY_CODE[code]!;
    const side = log.side[i] as WatchSide;
    const period = log.period[i]!;
    const clock = log.clock[i]!;
    const playerId = log.players[log.player[i]!]!;
    const player2Index = log.player2[i]!;
    const player2Id = player2Index >= 0 ? log.players[player2Index]! : null;
    const points = playCodePoints(code);
    const highlights: WatchHighlight[] = [];
    const pLabel = periodLabel(period);
    const cLabel = formatGameClock(clock);

    let foulsOut = false;
    if (isFoulCode(code)) {
      const total = (fouls.get(playerId) ?? 0) + 1;
      fouls.set(playerId, total);
      foulsOut = total === FOUL_OUT_FOULS;
    }

    const homeBefore = homeScore;
    const awayBefore = awayScore;
    if (points > 0) {
      if (side === 0) {
        homeScore += points;
      } else {
        awayScore += points;
      }
    }
    const text = playText(
      kind,
      nameOf(playerId).short,
      player2Id ? nameOf(player2Id).short : null,
      foulsOut,
    );
    const scoreText = scoreLabel(homeScore, awayScore);

    if (points > 0) {
      const margin = homeScore - awayScore;
      if (margin === 0 && homeScore + awayScore > 0) {
        highlights.push("tie");
        if (period >= REGULATION_PERIODS) {
          moments.push({
            order: i,
            kind: "tie",
            playIndex: i,
            periodLabel: pLabel,
            clockLabel: cLabel,
            side,
            title: "Tied up",
            detail: `Tied ${scoreText}`,
          });
        }
      } else if (margin !== 0) {
        const newLeader: WatchSide = margin > 0 ? 0 : 1;
        if (leader !== null && newLeader !== leader) {
          highlights.push("lead_change");
          if (period >= REGULATION_PERIODS) {
            moments.push({
              order: i,
              kind: "lead_change",
              playIndex: i,
              periodLabel: pLabel,
              clockLabel: cLabel,
              side: newLeader,
              title: "Lead change",
              detail: `${abbr(newLeader)} leads ${scoreText}`,
            });
          }
        }
        leader = newLeader;
      }

      if (run && run.side === side) {
        run.points += points;
      } else {
        closeRun(homeBefore, awayBefore);
        run = { side, points, reachedAt: null };
      }
      if (run.reachedAt === null && run.points >= RUN_THRESHOLD) {
        run.reachedAt = i;
        highlights.push("run");
      }

      const marginBefore = Math.abs(homeBefore - awayBefore);
      if (
        period >= CLUTCH_MIN_PERIOD &&
        clock <= CLUTCH_CLOCK_SECONDS &&
        marginBefore <= CLUTCH_MARGIN
      ) {
        highlights.push("clutch");
        const scorerBefore =
          side === 0 ? homeBefore - awayBefore : awayBefore - homeBefore;
        const scorerAfter = scorerBefore + points;
        const tying = scorerAfter === 0;
        const goAhead = scorerBefore <= 0 && scorerAfter > 0;
        if (tying || goAhead) {
          moments.push({
            order: i,
            kind: "clutch",
            playIndex: i,
            periodLabel: pLabel,
            clockLabel: cLabel,
            side,
            title: scoringTitle(goAhead ? "Go-ahead" : "Tying", kind),
            detail: text,
          });
        }
      }
    }

    if (foulsOut) {
      highlights.push("foul_out");
      moments.push({
        order: i,
        kind: "foul_out",
        playIndex: i,
        periodLabel: pLabel,
        clockLabel: cLabel,
        side,
        title: `${nameOf(playerId).short} fouls out`,
        detail: `${pLabel} ${cLabel}`,
      });
    }

    if (
      (code === PLAY_CODE.twoMade || code === PLAY_CODE.threeMade) &&
      i + 1 < count &&
      log.code[i + 1] === PLAY_CODE.shootingFoul &&
      log.poss[i + 1] === log.poss[i] &&
      log.period[i + 1] === period &&
      log.players[log.player2[i + 1]!] === playerId
    ) {
      highlights.push("and_one");
    }

    plays.push({
      index: i,
      period,
      periodLabel: pLabel,
      clock,
      clockLabel: cLabel,
      poss: log.poss[i]!,
      kind,
      side,
      playerId,
      player2Id,
      text,
      points,
      homeScore,
      awayScore,
      highlights,
    });
  }
  closeRun(homeScore, awayScore);

  const keyMoments = moments
    .map((moment, sequence) => ({ moment, sequence }))
    .sort(
      (a, b) =>
        a.moment.order - b.moment.order ||
        MOMENT_KIND_ORDER[a.moment.kind] - MOMENT_KIND_ORDER[b.moment.kind] ||
        a.sequence - b.sequence,
    )
    .map(({ moment }): KeyMoment => {
      const { order: _order, ...rest } = moment;
      return rest;
    });
  return { plays, keyMoments };
}

type MutableStats = Omit<
  LiveBoxScoreRow,
  "playerId" | "side" | "shortName" | "started" | "onCourt" | "fouledOut"
>;

function emptyStats(): MutableStats {
  return {
    points: 0,
    fgm: 0,
    fga: 0,
    threePm: 0,
    threePa: 0,
    ftm: 0,
    fta: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
  };
}

const STAT_KEYS = Object.keys(emptyStats()) as Array<keyof MutableStats>;

/** `revealed` clamped to a whole play count in [0, plays.length]. */
export function clampRevealed(view: WatchGameView, revealed: number): number {
  return Math.min(Math.max(0, Math.floor(revealed)), view.plays.length);
}

/**
 * On-court players per side ([home, away]) after the first `revealed` plays:
 * the starters, then each substitution in order. A substitute takes the
 * outgoing player's slot, so slot order is stable across substitutions.
 */
export function lineupAt(
  view: WatchGameView,
  revealed: number,
): [PlayerId[], PlayerId[]] {
  const count = clampRevealed(view, revealed);
  const lineups: [PlayerId[], PlayerId[]] = [[], []];
  const sideOf = new Map<PlayerId, WatchSide>();
  for (const player of view.players) {
    sideOf.set(player.playerId, player.side);
    if (player.started) {
      lineups[player.side].push(player.playerId);
    }
  }
  for (let i = 0; i < count; i += 1) {
    const play = view.plays[i]!;
    if (play.kind !== "substitution") {
      continue;
    }
    const outId = play.playerId;
    const inId = play.player2Id;
    const inOnCourt =
      inId !== null && (lineups[0].includes(inId) || lineups[1].includes(inId));
    let replaced = false;
    for (const lineup of lineups) {
      const slot = lineup.indexOf(outId);
      if (slot < 0) {
        continue;
      }
      if (inId !== null && !inOnCourt) {
        lineup[slot] = inId;
        replaced = true;
      } else {
        lineup.splice(slot, 1);
      }
    }
    if (inId !== null && !inOnCourt && !replaced) {
      const side = sideOf.get(inId);
      if (side !== undefined) {
        lineups[side].push(inId);
      }
    }
  }
  return lineups;
}

/** Box score after the first `revealed` plays. */
export function buildLiveBoxScore(
  view: WatchGameView,
  revealed: number,
): LiveBoxScore {
  const total = view.plays.length;
  const count = clampRevealed(view, revealed);
  const isFinal = count === total;

  const stats = new Map<PlayerId, MutableStats>();
  for (const player of view.players) {
    stats.set(player.playerId, emptyStats());
  }
  const lineups = lineupAt(view, count);
  const onCourt = new Set<PlayerId>([...lineups[0], ...lineups[1]]);
  const statsOf = (id: PlayerId | null): MutableStats | undefined =>
    id === null ? undefined : stats.get(id);

  for (let i = 0; i < count; i += 1) {
    const play = view.plays[i]!;
    const s = statsOf(play.playerId);
    const s2 = statsOf(play.player2Id);
    switch (play.kind) {
      case "two_made":
      case "three_made": {
        const three = play.kind === "three_made";
        if (s) {
          s.points += play.points;
          s.fgm += 1;
          s.fga += 1;
          if (three) {
            s.threePm += 1;
            s.threePa += 1;
          }
        }
        if (s2) {
          s2.assists += 1;
        }
        break;
      }
      case "two_missed":
      case "three_missed":
        if (s) {
          s.fga += 1;
          if (play.kind === "three_missed") {
            s.threePa += 1;
          }
        }
        if (s2) {
          s2.blocks += 1;
        }
        break;
      case "ft_made":
        if (s) {
          s.points += 1;
          s.ftm += 1;
          s.fta += 1;
        }
        break;
      case "ft_missed":
        if (s) {
          s.fta += 1;
        }
        break;
      case "offensive_rebound":
        if (s) {
          s.offensiveRebounds += 1;
          s.rebounds += 1;
        }
        break;
      case "defensive_rebound":
        if (s) {
          s.defensiveRebounds += 1;
          s.rebounds += 1;
        }
        break;
      case "turnover":
        if (s) {
          s.turnovers += 1;
        }
        if (s2) {
          s2.steals += 1;
        }
        break;
      case "shooting_foul":
      case "personal_foul":
      case "offensive_foul":
        if (s) {
          s.fouls += 1;
        }
        break;
      case "substitution":
        break;
    }
  }

  const last = count > 0 ? view.plays[count - 1]! : null;
  const currentPeriod = last?.period ?? 1;
  const periodFouls: [number, number] = [0, 0];
  for (let i = 0; i < count; i += 1) {
    const play = view.plays[i]!;
    if (
      play.period === currentPeriod &&
      (play.kind === "shooting_foul" ||
        play.kind === "personal_foul" ||
        play.kind === "offensive_foul")
    ) {
      periodFouls[play.side] += 1;
    }
  }

  const buildTeam = (side: WatchSide): LiveTeamBox => {
    const rows: LiveBoxScoreRow[] = view.players
      .filter((player) => player.side === side)
      .map((player) => {
        const s = stats.get(player.playerId)!;
        return {
          playerId: player.playerId,
          side,
          shortName: player.shortName,
          started: player.started,
          onCourt: onCourt.has(player.playerId),
          ...s,
          fouledOut: s.fouls >= FOUL_OUT_FOULS,
        };
      });
    const totals = emptyStats();
    for (const row of rows) {
      for (const key of STAT_KEYS) {
        totals[key] += row[key];
      }
    }
    return { rows, totals, periodFouls: periodFouls[side] };
  };

  return {
    revealed: count,
    homeScore: last?.homeScore ?? 0,
    awayScore: last?.awayScore ?? 0,
    periodLabel: isFinal ? "Final" : last ? last.periodLabel : periodLabel(1),
    clockLabel: isFinal
      ? "0:00"
      : last
        ? last.clockLabel
        : formatGameClock(START_PERIOD_CLOCK_SECONDS),
    isFinal,
    home: buildTeam(0),
    away: buildTeam(1),
  };
}

function emptyShotLine(): ShotLine {
  return {
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
}

function EMPTY_SHOT_SUMMARY(): ShotSummary {
  return {
    home: { total: emptyShotLine(), byPeriod: [] },
    away: { total: emptyShotLine(), byPeriod: [] },
    players: [],
  };
}

function addShot(line: ShotLine, play: WatchPlay): void {
  switch (play.kind) {
    case "two_made":
      line.twoPm += 1;
      line.twoPa += 1;
      line.fgm += 1;
      line.fga += 1;
      line.points += 2;
      if (play.player2Id !== null) {
        line.assistedFgm += 1;
      }
      break;
    case "three_made":
      line.threePm += 1;
      line.threePa += 1;
      line.fgm += 1;
      line.fga += 1;
      line.points += 3;
      if (play.player2Id !== null) {
        line.assistedFgm += 1;
      }
      break;
    case "two_missed":
      line.twoPa += 1;
      line.fga += 1;
      break;
    case "three_missed":
      line.threePa += 1;
      line.fga += 1;
      break;
    case "ft_made":
      line.ftm += 1;
      line.fta += 1;
      line.points += 1;
      break;
    case "ft_missed":
      line.fta += 1;
      break;
    default:
      break;
  }
}

function isShotKind(kind: WatchPlayKind): boolean {
  return (
    kind === "two_made" ||
    kind === "two_missed" ||
    kind === "three_made" ||
    kind === "three_missed" ||
    kind === "ft_made" ||
    kind === "ft_missed"
  );
}

/** Shot totals (team, per period, per player) over the first `revealed` plays. */
export function buildShotSummary(
  view: WatchGameView,
  revealed: number = view.plays.length,
): ShotSummary {
  const count = Math.min(Math.max(0, Math.floor(revealed)), view.plays.length);
  const makeTeam = (): TeamShotSummary => ({
    total: emptyShotLine(),
    byPeriod: view.periodScores.map(() => emptyShotLine()),
  });
  const teams: [TeamShotSummary, TeamShotSummary] = [makeTeam(), makeTeam()];
  const byPlayer = new Map<PlayerId, ShotLine>();

  for (let i = 0; i < count; i += 1) {
    const play = view.plays[i]!;
    if (!isShotKind(play.kind)) {
      continue;
    }
    const team = teams[play.side];
    addShot(team.total, play);
    const periodLine = team.byPeriod[play.period - 1];
    if (periodLine) {
      addShot(periodLine, play);
    }
    let line = byPlayer.get(play.playerId);
    if (!line) {
      line = emptyShotLine();
      byPlayer.set(play.playerId, line);
    }
    addShot(line, play);
  }

  const order = new Map(view.players.map((p, index) => [p.playerId, index]));
  const players = [...byPlayer.entries()]
    .map(([playerId, line]) => {
      const watchPlayer = view.players.find((p) => p.playerId === playerId);
      return {
        playerId,
        side: (watchPlayer?.side ?? 0) as WatchSide,
        line,
        name: watchPlayer?.fullName ?? (playerId as string),
      };
    })
    .sort(
      (a, b) =>
        b.line.points - a.line.points ||
        a.name.localeCompare(b.name) ||
        (order.get(a.playerId) ?? 0) - (order.get(b.playerId) ?? 0),
    )
    .map(({ playerId, side, line }) => ({ playerId, side, line }));

  return { home: teams[0], away: teams[1], players };
}
