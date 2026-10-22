/** Small text helpers shared by post and reply composition. */

import type {
  GameAttachment,
  TimelinePlayerRef,
  TimelineTeamRef,
} from "./types";

export function fullName(ref: TimelinePlayerRef): string {
  return `${ref.firstName} ${ref.lastName}`.trim();
}

/**
 * "RedWolves": the club nickname without spaces, used as the team's tag.
 * Nicknames are unique per league; abbreviations are not safe as tags because
 * many read as English words (NEW, CAN, WAR).
 */
export function teamTagLabel(team: { name: string }): string {
  return team.name.replace(/[^A-Za-z0-9]/g, "");
}

/** "#RedWolves" */
export function teamTag(team: TimelineTeamRef | null | undefined): string {
  const clean = team ? teamTagLabel(team) : "";
  return clean ? `#${clean}` : "";
}

/** "2026–27" for the season that starts in `startYear`. */
export function formatSeasonLabel(startYear: number): string {
  return `${startYear}–${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** "#AWYvsHOM": away abbreviation, "vs", home abbreviation. */
export function gameTag(game: GameAttachment): string {
  const clean = (value: string) => value.replace(/[^A-Za-z0-9]/g, "");
  return `#${clean(game.away.abbreviation)}vs${clean(game.home.abbreviation)}`;
}

export function gameSides(game: GameAttachment): {
  winner: TimelineTeamRef;
  loser: TimelineTeamRef;
  winnerScore: number;
  loserScore: number;
  winnerIsHome: boolean;
} {
  const winnerIsHome = game.winnerTeamId === game.home.teamId;
  return {
    winner: winnerIsHome ? game.home : game.away,
    loser: winnerIsHome ? game.away : game.home,
    winnerScore: winnerIsHome ? game.score.home : game.score.away,
    loserScore: winnerIsHome ? game.score.away : game.score.home,
    winnerIsHome,
  };
}

/** Joins non-empty parts with single spaces. */
export function joinParts(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter((part): part is string => Boolean(part)).join(" ");
}

/** "a", "a and b", "a, b and c". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "October" from "2026-10"; null for anything else. */
export function monthName(period: string | null): string | null {
  const match = period ? /^(\d{4})-(\d{2})$/.exec(period) : null;
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
  }).format(date);
}

/** "the Hawks": club names read with an article mid-sentence. */
export function the(team: { name: string }): string {
  return `the ${team.name}`;
}

/** Capitalizes the first letter of each sentence ("the Hawks win" -> "The Hawks win"). */
export function sentenceCase(text: string): string {
  return text.replace(
    /(^|[.!?]\s+)([a-z])/g,
    (_m, lead: string, c: string) => `${lead}${c.toUpperCase()}`,
  );
}

const MISSING_BODY_PARTS = new Set([
  "",
  "unknown",
  "undisclosed",
  "unspecified",
  "none",
  "n/a",
  "other",
]);

/** Plain-words body part ("lower_back" -> "lower back"), or null when not disclosed. */
export function cleanBodyPart(bodyPart: string | null): string | null {
  if (!bodyPart) return null;
  const words = bodyPart.replace(/[_-]+/g, " ").trim().toLowerCase();
  return MISSING_BODY_PARTS.has(words) ? null : words;
}

/** "an ankle injury", "a moderate knee injury". */
export function withArticle(phrase: string): string {
  return `${/^[aeiou]/i.test(phrase) ? "an" : "a"} ${phrase}`;
}
