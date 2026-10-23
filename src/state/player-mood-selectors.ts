/**
 * Mood chip for roster rows and the player drawer: a band and the main
 * reason. Presentation only; morale lives in systems/player-morale.
 */

import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getPlayerMorale, MORALE_REASON_LABELS } from "@/systems/player-morale";

export type PlayerMoodBand = "happy" | "content" | "unhappy" | "upset";

export type PlayerMoodView = {
  value: number;
  band: PlayerMoodBand;
  /** Short label for the chip ("Happy", "Unhappy", ...). */
  label: string;
  /** Main reason, e.g. "Wants more minutes". */
  reason: string;
  /** He has asked for a trade this season. */
  tradeRequested: boolean;
};

export function toPlayerMoodView(
  state: GameState,
  playerId: string,
): PlayerMoodView {
  const mood = getPlayerMorale(state, playerId as PlayerId);
  const band: PlayerMoodBand =
    mood.value >= 70
      ? "happy"
      : mood.value >= 45
        ? "content"
        : mood.value >= 30
          ? "unhappy"
          : "upset";
  const label = {
    happy: "Happy",
    content: "Content",
    unhappy: "Unhappy",
    upset: "Upset",
  }[band];
  return {
    value: mood.value,
    band,
    label,
    reason: MORALE_REASON_LABELS[mood.reason],
    tradeRequested: mood.tradeRequestSeason === state.competition.season.year,
  };
}
