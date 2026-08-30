/**
 * Injury history archive and lookups for reinjury / long-term effect checks.
 */

import { INJURY_HISTORY_MAX, type InjuryHistoryEntry } from "@/domain/entities/injury";
import type { Player, PlayerInjury } from "@/domain/entities/player";
import type { InjuryCalendarDate } from "@/domain/entities/injury";

export function toHistoryEntry(
  injury: PlayerInjury,
  recoveredOn: InjuryCalendarDate,
  gamesMissed: number,
  hadLongTermEffect: boolean,
): InjuryHistoryEntry {
  const start = Date.parse(`${injury.injuredOn}T12:00:00Z`);
  const end = Date.parse(`${recoveredOn}T12:00:00Z`);
  const recoveryDays =
    Number.isFinite(start) && Number.isFinite(end)
      ? Math.max(0, Math.round((end - start) / 86_400_000))
      : 0;
  return {
    injuryId: injury.injuryId,
    catalogKey: injury.catalogKey,
    type: injury.type,
    bodyPart: injury.bodyPart,
    severity: injury.severity,
    injuredOn: injury.injuredOn,
    recoveredOn,
    gamesMissed,
    recoveryDays,
    isReinjury: injury.isReinjury,
    isAggravation: injury.isAggravation,
    exposureSource: injury.exposureSource,
    hadLongTermEffect,
  };
}

export function appendInjuryHistory(
  player: Player,
  entry: InjuryHistoryEntry,
): Player {
  const next = [entry, ...player.injuryHistory].slice(0, INJURY_HISTORY_MAX);
  return { ...player, injuryHistory: next };
}

export function countBodyPartHistory(
  player: Player,
  bodyPart: PlayerInjury["bodyPart"],
): number {
  return player.injuryHistory.filter((entry) => entry.bodyPart === bodyPart)
    .length;
}

export function recentSameBodyPartInjury(
  player: Player,
  bodyPart: PlayerInjury["bodyPart"],
  withinDays: number,
  asOf: InjuryCalendarDate,
): InjuryHistoryEntry | null {
  const asOfMs = Date.parse(`${asOf}T12:00:00Z`);
  for (const entry of player.injuryHistory) {
    if (entry.bodyPart !== bodyPart) continue;
    const recovered = entry.recoveredOn ?? entry.injuredOn;
    const recoveredMs = Date.parse(`${recovered}T12:00:00Z`);
    if (!Number.isFinite(recoveredMs) || !Number.isFinite(asOfMs)) continue;
    const days = Math.round((asOfMs - recoveredMs) / 86_400_000);
    if (days >= 0 && days <= withinDays) {
      return entry;
    }
  }
  return null;
}
