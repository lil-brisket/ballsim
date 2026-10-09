import {
  asDraftPickId,
  asPlayerId,
  asTeamId,
  type DraftPickId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";

/**
 * Assets one team sends in a two-team trade.
 * sideA sends these to sideB (and vice versa on the other side).
 */
export type TradeSide = {
  teamId: TeamId;
  playerIds: PlayerId[];
  draftPickIds: DraftPickId[];
};

/**
 * Canonical two-team trade proposal.
 * sideA sends its listed assets to sideB; sideB sends its listed assets to sideA.
 */
export type TradeProposal = {
  sideA: TradeSide;
  sideB: TradeSide;
};

export function tradeSideAssetCount(side: TradeSide): number {
  return side.playerIds.length + side.draftPickIds.length;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseTradeSide(value: unknown): TradeSide | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.teamId !== "string") {
    return null;
  }
  if (!isStringArray(record.playerIds) || !isStringArray(record.draftPickIds)) {
    return null;
  }
  return {
    teamId: asTeamId(record.teamId),
    playerIds: record.playerIds.map(asPlayerId),
    draftPickIds: record.draftPickIds.map(asDraftPickId),
  };
}

/**
 * Parse a TradeProposal from JSON or a plain object. Returns null on any
 * shape error — callers must not execute an unparsed payload.
 */
export function parseTradeProposal(value: unknown): TradeProposal | null {
  let raw: unknown = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const sideA = parseTradeSide(record.sideA);
  const sideB = parseTradeSide(record.sideB);
  if (sideA === null || sideB === null) {
    return null;
  }
  return { sideA, sideB };
}

export function proposalSendsPlayer(
  proposal: TradeProposal,
  teamId: TeamId,
  playerId: PlayerId,
): boolean {
  const side =
    proposal.sideA.teamId === teamId
      ? proposal.sideA
      : proposal.sideB.teamId === teamId
        ? proposal.sideB
        : null;
  return side?.playerIds.includes(playerId) ?? false;
}
