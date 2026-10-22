/**
 * Lottery night view: the stored draw for the latest draft, slot by slot,
 * with each team's odds and how far it moved. Presentation only.
 */

import { draftClassIdFor } from "@/domain/entities/draft";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { draftYearForSeason } from "@/systems/draft/draft-order";

export type DraftLotterySlotView = {
  /** Final first-round slot, 1-based. */
  slot: number;
  teamId: string;
  teamName: string;
  abbreviation: string;
  /** Team colours and logo for the badge (null: initials plate). */
  branding: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoId: string;
  } | null;
  /** Slot by record before the draw, 1-based. */
  preLotterySlot: number;
  /** Positive: moved up. */
  movement: number;
  /** Chance of the first pick before the draw (0-1). */
  odds: number;
  /** Decided by the draw (otherwise by record). */
  drawn: boolean;
  /** Owner of the pick (may differ after a trade). */
  ownerTeamId: string | null;
  isUserTeam: boolean;
};

export type DraftLotteryView = {
  draftYear: number;
  heldOn: string;
  picksDrawn: number;
  /** Slots from first to last. Reveal order is last to first. */
  slots: DraftLotterySlotView[];
  /** Team that climbed the most (null when nobody moved up). */
  biggestJump: { teamName: string; movement: number } | null;
};

/** Null when the next draft has no lottery result (lottery off or not run). */
export function toDraftLotteryView(state: GameState): DraftLotteryView | null {
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draft = state.world.drafts[draftClassIdFor(draftYear)];
  const lottery = draft?.lottery;
  if (!draft || !lottery) return null;
  const userTeamId = getActiveOwnerTeamId(state);
  const ownerByOriginal = new Map<string, string>();
  for (const slot of draft.order) {
    if (slot.round !== 1) continue;
    const pick = state.world.draftPicks[slot.draftPickId];
    if (pick) ownerByOriginal.set(pick.originalTeamId, slot.ownerTeamId);
  }
  const slots = lottery.finalOrder.map((teamId, index) => {
    const team = state.world.teams[teamId];
    const pre = lottery.preLotteryOrder.indexOf(teamId);
    const owner = ownerByOriginal.get(teamId) ?? null;
    return {
      slot: index + 1,
      teamId,
      teamName: team ? `${team.city} ${team.name}` : teamId,
      abbreviation: team?.abbreviation ?? "",
      branding: team
        ? {
            primaryColor: team.branding.primaryColor,
            secondaryColor: team.branding.secondaryColor,
            accentColor: team.branding.accentColor,
            logoId: team.branding.logoId,
          }
        : null,
      preLotterySlot: pre + 1,
      movement: pre - index,
      odds: lottery.odds[pre] ?? 0,
      drawn: index < lottery.picksDrawn,
      ownerTeamId: owner,
      isUserTeam: teamId === userTeamId || owner === userTeamId,
    };
  });
  const top = [...slots].sort((a, b) => b.movement - a.movement)[0];
  return {
    draftYear,
    heldOn: lottery.heldOn,
    picksDrawn: lottery.picksDrawn,
    slots,
    biggestJump:
      top && top.movement > 0
        ? { teamName: top.teamName, movement: top.movement }
        : null,
  };
}
