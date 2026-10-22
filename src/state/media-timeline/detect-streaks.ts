import type { Game } from "@/domain/entities/game";
import type { DetectorInput } from "./detector-input";
import type { StreakAttachment, TimelinePost } from "./types";

export const STREAK_THRESHOLDS = {
  /** Win streak posts at this length and every `step` after. */
  winStreak: 5,
  /** Losing streak posts at this length and every `step` after. */
  losingStreak: 7,
  step: 5,
  /** A win streak at least this long gets a post when it ends. */
  snapped: 8,
} as const;

export function detectStreaks(input: DetectorInput): TimelinePost[] {
  const posts: TimelinePost[] = [];
  for (const game of input.ctx.games) {
    const before = input.ctx.streakBefore.get(game.id);
    const after = input.ctx.streakAfter.get(game.id);
    if (!before || !after) continue;
    const sides = [
      [game.homeTeamId, before.home, after.home, game.awayTeamId],
      [game.awayTeamId, before.away, after.away, game.homeTeamId],
    ] as const;
    for (const [teamId, prior, next, opponentId] of sides) {
      const event = streakEvent(prior, next);
      if (!event) continue;
      posts.push(toPost(input, game, teamId, opponentId, event));
    }
  }
  return posts;
}

type StreakEvent = { kind: StreakAttachment["event"]; length: number };

export function streakEvent(prior: number, next: number): StreakEvent | null {
  const t = STREAK_THRESHOLDS;
  if (next >= t.winStreak && (next - t.winStreak) % t.step === 0) {
    return { kind: "win_streak", length: next };
  }
  if (-next >= t.losingStreak && (-next - t.losingStreak) % t.step === 0) {
    return { kind: "losing_streak", length: -next };
  }
  if (prior >= t.snapped && next < 0) {
    return { kind: "streak_snapped", length: prior };
  }
  return null;
}

function toPost(
  input: DetectorInput,
  game: Game,
  teamId: string,
  opponentId: string,
  event: StreakEvent,
): TimelinePost {
  const snapshotFor = (id: string) =>
    id === game.homeTeamId ? game.homeTeamSnapshot : game.awayTeamSnapshot;
  const team = input.refs.team(teamId, snapshotFor(teamId));
  const opponent = input.refs.team(opponentId, snapshotFor(opponentId));
  const notability =
    event.kind === "win_streak"
      ? Math.min(90, 40 + 3 * event.length)
      : event.kind === "losing_streak"
        ? Math.min(75, 35 + 2 * event.length)
        : Math.min(90, 45 + 2 * event.length);
  return {
    id: `streak:${game.id}:${teamId}`,
    occurredOn: game.date,
    kind: "streak",
    importance: notability >= 70 ? "high" : "medium",
    notability,
    relevance: 0,
    teamIds: event.kind === "streak_snapped" ? [teamId, opponentId] : [teamId],
    playerIds: [],
    gameId: game.id,
    attachment: {
      type: "streak",
      team,
      event: event.kind,
      length: event.length,
      snappedBy: event.kind === "streak_snapped" ? opponent : null,
      gameId: game.id,
    },
    tags:
      event.kind === "streak_snapped"
        ? [team.abbreviation, opponent.abbreviation]
        : [team.abbreviation],
    unread: false,
  };
}
