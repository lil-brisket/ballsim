/**
 * Parses the team-game headline produced for simulation summaries, e.g.
 * "W 112–104 vs SAC", so the UI can show it as a scoreboard row. Returns null
 * for any other format; callers then fall back to the plain headline text.
 * Presentation only; the headline itself is built in the systems layer.
 */

export type GameResultHeadline = {
  result: "W" | "L" | "T";
  teamScore: number;
  opponentScore: number;
  opponent: string;
};

const RESULT_HEADLINE = /^([WLT]) (\d+)[–-](\d+) vs (.+)$/;

export function parseGameResultHeadline(
  headline: string,
): GameResultHeadline | null {
  const match = RESULT_HEADLINE.exec(headline.trim());
  if (!match) {
    return null;
  }
  return {
    result: match[1] as GameResultHeadline["result"],
    teamScore: Number(match[2]),
    opponentScore: Number(match[3]),
    opponent: match[4]!,
  };
}
