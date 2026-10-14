import {
  isFantasyDraftStatus,
  isFantasyDraftType,
  isFantasyDraftOrderMode,
  isFantasyDraftAutoPickStrategy,
} from "@/domain/entities/fantasy-draft";
import {
  assertRecord,
  assertNumber,
  assertNonEmptyString,
} from "@/persistence/validate-game-state/primitives";

export function validateFantasyDraft(
  draftValue: unknown,
  world: Record<string, unknown>,
  failFn: (message: string) => never,
): void {
  assertRecord(draftValue, "world.fantasyDraft");
  const draft = draftValue as Record<string, unknown>;
  assertNumber(draft.version, "world.fantasyDraft.version");
  if (
    !Number.isInteger(draft.version as number) ||
    (draft.version as number) < 1
  ) {
    failFn("world.fantasyDraft.version must be an integer >= 1.");
  }
  if (!isFantasyDraftStatus(draft.status)) {
    failFn("world.fantasyDraft.status is invalid.");
  }
  if (!isFantasyDraftType(draft.draftType)) {
    failFn("world.fantasyDraft.draftType is invalid.");
  }
  if (!isFantasyDraftOrderMode(draft.orderMode)) {
    failFn("world.fantasyDraft.orderMode is invalid.");
  }
  if (!Array.isArray(draft.draftOrder)) {
    failFn("world.fantasyDraft.draftOrder must be an array.");
  }
  if (typeof draft.orderConfirmed !== "boolean") {
    failFn("world.fantasyDraft.orderConfirmed must be a boolean.");
  }
  assertNumber(draft.picksPerTeam, "world.fantasyDraft.picksPerTeam");
  assertNumber(draft.totalPicks, "world.fantasyDraft.totalPicks");
  if (!Array.isArray(draft.poolPlayerIds)) {
    failFn("world.fantasyDraft.poolPlayerIds must be an array.");
  }
  if (
    draft.currentPickNumber !== null &&
    (typeof draft.currentPickNumber !== "number" ||
      !Number.isInteger(draft.currentPickNumber) ||
      (draft.currentPickNumber as number) < 1)
  ) {
    failFn(
      "world.fantasyDraft.currentPickNumber must be null or an integer >= 1.",
    );
  }
  if (!Array.isArray(draft.selectedPlayerIds)) {
    failFn("world.fantasyDraft.selectedPlayerIds must be an array.");
  }
  if (!Array.isArray(draft.selections)) {
    failFn("world.fantasyDraft.selections must be an array.");
  }
  assertRecord(draft.timer, "world.fantasyDraft.timer");
  const timer = draft.timer as Record<string, unknown>;
  if (typeof timer.enabled !== "boolean") {
    failFn("world.fantasyDraft.timer.enabled must be a boolean.");
  }
  assertNumber(timer.secondsPerPick, "world.fantasyDraft.timer.secondsPerPick");
  if (timer.pickStartedAt !== null && typeof timer.pickStartedAt !== "string") {
    failFn("world.fantasyDraft.timer.pickStartedAt must be null or a string.");
  }
  if (draft.pausedAt !== null && typeof draft.pausedAt !== "string") {
    failFn("world.fantasyDraft.pausedAt must be null or a string.");
  }
  assertRecord(draft.userTeamAutoPick, "world.fantasyDraft.userTeamAutoPick");
  assertRecord(draft.teamQueues, "world.fantasyDraft.teamQueues");
  assertRecord(draft.autoPickStrategy, "world.fantasyDraft.autoPickStrategy");
  assertRecord(draft.settings, "world.fantasyDraft.settings");
  const settings = draft.settings as Record<string, unknown>;
  if (typeof settings.confirmPicks !== "boolean") {
    failFn("world.fantasyDraft.settings.confirmPicks must be a boolean.");
  }
  if (!Array.isArray(draft.pickAnalyses)) {
    failFn("world.fantasyDraft.pickAnalyses must be an array.");
  }
  assertRecord(draft.teamSummaries, "world.fantasyDraft.teamSummaries");
  if (draft.leagueRecap !== null && typeof draft.leagueRecap !== "object") {
    failFn("world.fantasyDraft.leagueRecap must be null or an object.");
  }

  for (const [teamId, strategy] of Object.entries(
    draft.autoPickStrategy as Record<string, unknown>,
  )) {
    assertNonEmptyString(teamId, "world.fantasyDraft.autoPickStrategy key");
    if (!isFantasyDraftAutoPickStrategy(strategy)) {
      failFn(`world.fantasyDraft.autoPickStrategy["${teamId}"] is invalid.`);
    }
  }

  for (const [teamId, queueValue] of Object.entries(
    draft.teamQueues as Record<string, unknown>,
  )) {
    assertNonEmptyString(teamId, "world.fantasyDraft.teamQueues key");
    if (!Array.isArray(queueValue)) {
      failFn(`world.fantasyDraft.teamQueues["${teamId}"] must be an array.`);
    }
    for (let i = 0; i < (queueValue as unknown[]).length; i += 1) {
      assertNonEmptyString(
        (queueValue as unknown[])[i],
        `world.fantasyDraft.teamQueues["${teamId}"][${i}]`,
      );
    }
  }

  const teams = world.teams as Record<string, unknown>;
  const players = world.players as Record<string, unknown>;
  const teamIds = new Set(Object.keys(teams));
  const playerIds = new Set(Object.keys(players));
  const seenSelected = new Set<string>();

  for (let i = 0; i < (draft.draftOrder as unknown[]).length; i += 1) {
    const teamId = (draft.draftOrder as unknown[])[i];
    assertNonEmptyString(teamId, `world.fantasyDraft.draftOrder[${i}]`);
    if (!teamIds.has(teamId as string)) {
      failFn(
        `world.fantasyDraft.draftOrder[${i}] "${String(teamId)}" is missing from world.teams.`,
      );
    }
  }

  for (let i = 0; i < (draft.poolPlayerIds as unknown[]).length; i += 1) {
    const playerId = (draft.poolPlayerIds as unknown[])[i];
    assertNonEmptyString(playerId, `world.fantasyDraft.poolPlayerIds[${i}]`);
    if (!playerIds.has(playerId as string)) {
      failFn(
        `world.fantasyDraft.poolPlayerIds[${i}] is missing from world.players.`,
      );
    }
  }

  for (let i = 0; i < (draft.selectedPlayerIds as unknown[]).length; i += 1) {
    const playerId = (draft.selectedPlayerIds as unknown[])[i] as string;
    assertNonEmptyString(
      playerId,
      `world.fantasyDraft.selectedPlayerIds[${i}]`,
    );
    if (seenSelected.has(playerId)) {
      failFn(
        `world.fantasyDraft.selectedPlayerIds duplicates player "${playerId}".`,
      );
    }
    seenSelected.add(playerId);
  }

  for (let i = 0; i < (draft.selections as unknown[]).length; i += 1) {
    const selection = (draft.selections as unknown[])[i];
    assertRecord(selection, `world.fantasyDraft.selections[${i}]`);
    const sel = selection as Record<string, unknown>;
    assertNumber(
      sel.pickNumber,
      `world.fantasyDraft.selections[${i}].pickNumber`,
    );
    assertNumber(sel.round, `world.fantasyDraft.selections[${i}].round`);
    assertNumber(
      sel.pickInRound,
      `world.fantasyDraft.selections[${i}].pickInRound`,
    );
    assertNonEmptyString(
      sel.teamId,
      `world.fantasyDraft.selections[${i}].teamId`,
    );
    assertNonEmptyString(
      sel.playerId,
      `world.fantasyDraft.selections[${i}].playerId`,
    );
    assertNonEmptyString(
      sel.contractId,
      `world.fantasyDraft.selections[${i}].contractId`,
    );
    assertNonEmptyString(
      sel.selectedAt,
      `world.fantasyDraft.selections[${i}].selectedAt`,
    );
    if (!teamIds.has(sel.teamId as string)) {
      failFn(
        `world.fantasyDraft.selections[${i}].teamId is missing from world.teams.`,
      );
    }
    if (!playerIds.has(sel.playerId as string)) {
      failFn(
        `world.fantasyDraft.selections[${i}].playerId is missing from world.players.`,
      );
    }
  }
}
