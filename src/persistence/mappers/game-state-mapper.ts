import { reconcileJerseyNumbers } from "@/systems/jersey-numbers";
import { z } from "zod";
import { type GameState, GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { reconcileTradeBlocks } from "@/systems/trades/trade-block";
import { validateGameState } from "@/persistence/validate-game-state";
import { reconcilePhaseWithState } from "@/systems/simulation/phase-lifecycle";
import {
  migrateV1ToV2,
  type GameStateV1,
  migrateV2ToV3,
  type GameStateV2,
  migrateV3ToV4,
  type GameStateV3,
  migrateV4ToV5,
  type GameStateV4,
  migrateV5ToV6,
  type GameStateV5,
  migrateV6ToV7,
  type GameStateV6,
  migrateV7ToV8,
  type GameStateV7,
} from "@/persistence/mappers/game-state-migrations/v01-v07";
import {
  migrateV8ToV9,
  type GameStateV8,
  migrateV9ToV10,
  type GameStateV9,
  migrateV10ToV11,
  type GameStateV10,
  migrateV11ToV12,
  type GameStateV11,
  migrateV12ToV13,
  type GameStateV12,
} from "@/persistence/mappers/game-state-migrations/v08-v12";
import {
  migrateV13ToV14,
  type GameStateV13,
  migrateV14ToV15,
  type GameStateV14,
  migrateV15ToV16,
  type GameStateV15,
  migrateV16ToV17,
  type GameStateV16,
  migrateV17ToV18,
  type GameStateV17,
  migrateV18ToV19,
  type GameStateV18,
  migrateV19ToV20,
  type GameStateV19,
  migrateV20ToV21,
  type GameStateV20,
  migrateV21ToV22,
  type GameStateV21,
  migrateV22ToV23,
  type GameStateV22,
  migrateV23ToV24,
  type GameStateV23,
} from "@/persistence/mappers/game-state-migrations/v13-v23";
import {
  migrateV24ToV25,
  type GameStateV24,
  migrateV25ToV26,
  type GameStateV25,
  migrateV26ToV27,
  type GameStateV26,
  migrateV27ToV28,
  type GameStateV27,
  migrateV28ToV29,
  type GameStateV28,
  migrateV29ToV30,
  type GameStateV29,
  migrateV30ToV31,
  type GameStateV30,
  migrateV31ToV32,
  type GameStateV31,
  migrateV32ToV33,
  type GameStateV32,
  migrateV33ToV34,
  type GameStateV33,
} from "@/persistence/mappers/game-state-migrations/v24-v33";
import {
  migrateV34ToV35,
  type GameStateV34,
  migrateV35ToV36,
  type GameStateV35,
  migrateV36ToV37,
  type GameStateV36,
  migrateV37ToV38,
  type GameStateV37,
  migrateV38ToV39,
  type GameStateV38,
  migrateV39ToV40,
  type GameStateV39,
  migrateV40ToV41,
  type GameStateV40,
  migrateV41ToV42,
  type GameStateV41,
} from "@/persistence/mappers/game-state-migrations/v34-v41";
import {
  migrateV42ToV43,
  type GameStateV42,
  migrateV43ToV44,
  type GameStateV43,
  migrateV44ToV45,
  type GameStateV44,
  migrateV45ToV46,
  type GameStateV45,
  migrateV46ToV47,
  type GameStateV46,
  migrateV47ToV48,
  type GameStateV47,
} from "@/persistence/mappers/game-state-migrations/v42-v47";
import {
  migrateV48ToV49,
  type GameStateV48,
  migrateV49ToV50,
  type GameStateV49,
  migrateV50ToV51,
  type GameStateV50,
  migrateV51ToV52,
  type GameStateV51,
  migrateV52ToV53,
  type GameStateV52,
  migrateV53ToV54,
  type GameStateV53,
  migrateV54ToV55,
  type GameStateV54,
  migrateV55ToV56,
  type GameStateV55,
} from "@/persistence/mappers/game-state-migrations/v48-v55";
import {
  migrateV56ToV57,
  type GameStateV56,
  migrateV57ToV58,
  type GameStateV57,
  migrateV58ToV59,
  type GameStateV58,
  migrateV59ToV60,
  type GameStateV59,
  migrateV60ToV61,
  type GameStateV60,
  migrateV61ToV62,
  type GameStateV61,
  migrateV62ToV63,
  type GameStateV62,
  migrateV63ToV64,
  type GameStateV63,
  migrateV64ToV65,
  type GameStateV64,
  migrateV65ToV66,
  type GameStateV65,
} from "@/persistence/mappers/game-state-migrations/v56-v65";
import {
  migrateV66ToV67,
  type GameStateV66,
  migrateV67ToV68,
  migrateV68ToV69,
  migrateV69ToV70,
  migrateV70ToV71,
  migrateV71ToV72,
  migrateV72ToV73,
  migrateV73ToV74,
  migrateV74ToV75,
  type GameStateV67,
  type GameStateV68,
  type GameStateV69,
  type GameStateV70,
  type GameStateV71,
  type GameStateV72,
  type GameStateV73,
  type GameStateV74,
} from "@/persistence/mappers/game-state-migrations/v66-v75";

const gameStateEnvelopeSchema = z.object({
  meta: z.object({
    saveId: z.string().min(1),
    schemaVersion: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
    rngSeed: z.number().int(),
    rngState: z.number().int().optional(),
  }),
  world: z
    .object({
      calendar: z.unknown(),
      league: z.unknown(),
      conferences: z.unknown(),
      divisions: z.unknown(),
      teams: z.unknown(),
      players: z.unknown(),
      coaches: z.unknown(),
      staff: z.unknown(),
    })
    .passthrough(),
  competition: z
    .object({
      season: z.unknown(),
      schedule: z.unknown(),
      games: z.unknown(),
      standings: z.unknown(),
    })
    .passthrough(),
  business: z
    .object({
      contracts: z.unknown(),
      finances: z.unknown(),
    })
    .passthrough(),
  user: z
    .object({
      ownedTeamIds: z.unknown().optional(),
      activeOwnerTeamId: z.unknown().optional(),
      controlledTeamId: z.unknown().optional(),
      mode: z.unknown(),
    })
    .passthrough(),
});

/** JSON.stringify only. Does not validate or mutate state. */
export function serializeGameState(state: GameState): string {
  return JSON.stringify(state);
}

/**
 * One-step upgrades keyed by the source schema version.
 * Current version is never keyed here — no nonexistent N→N+1 step.
 */
const MIGRATE_ONE_STEP: Record<number, (state: unknown) => unknown> = {
  1: (state) => migrateV1ToV2(state as GameStateV1),
  2: (state) => migrateV2ToV3(state as GameStateV2),
  3: (state) => migrateV3ToV4(state as GameStateV3),
  4: (state) => migrateV4ToV5(state as GameStateV4),
  5: (state) => migrateV5ToV6(state as GameStateV5),
  6: (state) => migrateV6ToV7(state as GameStateV6),
  7: (state) => migrateV7ToV8(state as GameStateV7),
  8: (state) => migrateV8ToV9(state as GameStateV8),
  9: (state) => migrateV9ToV10(state as GameStateV9),
  10: (state) => migrateV10ToV11(state as GameStateV10),
  11: (state) => migrateV11ToV12(state as GameStateV11),
  12: (state) => migrateV12ToV13(state as GameStateV12),
  13: (state) => migrateV13ToV14(state as GameStateV13),
  14: (state) => migrateV14ToV15(state as GameStateV14),
  15: (state) => migrateV15ToV16(state as GameStateV15),
  16: (state) => migrateV16ToV17(state as GameStateV16),
  17: (state) => migrateV17ToV18(state as GameStateV17),
  18: (state) => migrateV18ToV19(state as GameStateV18),
  19: (state) => migrateV19ToV20(state as GameStateV19),
  20: (state) => migrateV20ToV21(state as GameStateV20),
  21: (state) => migrateV21ToV22(state as GameStateV21),
  22: (state) => migrateV22ToV23(state as GameStateV22),
  23: (state) => migrateV23ToV24(state as GameStateV23),
  24: (state) => migrateV24ToV25(state as GameStateV24),
  25: (state) => migrateV25ToV26(state as GameStateV25),
  26: (state) => migrateV26ToV27(state as GameStateV26),
  27: (state) => migrateV27ToV28(state as GameStateV27),
  28: (state) => migrateV28ToV29(state as GameStateV28),
  29: (state) => migrateV29ToV30(state as GameStateV29),
  30: (state) => migrateV30ToV31(state as GameStateV30),
  31: (state) => migrateV31ToV32(state as GameStateV31),
  32: (state) => migrateV32ToV33(state as GameStateV32),
  33: (state) => migrateV33ToV34(state as GameStateV33),
  34: (state) => migrateV34ToV35(state as GameStateV34),
  35: (state) => migrateV35ToV36(state as GameStateV35),
  36: (state) => migrateV36ToV37(state as GameStateV36),
  37: (state) => migrateV37ToV38(state as GameStateV37),
  38: (state) => migrateV38ToV39(state as GameStateV38),
  39: (state) => migrateV39ToV40(state as GameStateV39),
  40: (state) => migrateV40ToV41(state as GameStateV40),
  41: (state) => migrateV41ToV42(state as GameStateV41),
  42: (state) => migrateV42ToV43(state as GameStateV42),
  43: (state) => migrateV43ToV44(state as GameStateV43),
  44: (state) => migrateV44ToV45(state as GameStateV44),
  45: (state) => migrateV45ToV46(state as GameStateV45),
  46: (state) => migrateV46ToV47(state as GameStateV46),
  47: (state) => migrateV47ToV48(state as GameStateV47),
  48: (state) => migrateV48ToV49(state as GameStateV48),
  49: (state) => migrateV49ToV50(state as GameStateV49),
  50: (state) => migrateV50ToV51(state as GameStateV50),
  51: (state) => migrateV51ToV52(state as GameStateV51),
  52: (state) => migrateV52ToV53(state as GameStateV52),
  53: (state) => migrateV53ToV54(state as GameStateV53),
  54: (state) => migrateV54ToV55(state as GameStateV54),
  55: (state) => migrateV55ToV56(state as GameStateV55),
  56: (state) => migrateV56ToV57(state as GameStateV56),
  57: (state) => migrateV57ToV58(state as GameStateV57),
  58: (state) => migrateV58ToV59(state as GameStateV58),
  59: (state) => migrateV59ToV60(state as GameStateV59),
  60: (state) => migrateV60ToV61(state as GameStateV60),
  61: (state) => migrateV61ToV62(state as GameStateV61),
  62: (state) => migrateV62ToV63(state as GameStateV62),
  63: (state) => migrateV63ToV64(state as GameStateV63),
  64: (state) => migrateV64ToV65(state as GameStateV64),
  65: (state) => migrateV65ToV66(state as GameStateV65),
  66: (state) => migrateV66ToV67(state as GameStateV66),
  67: (state) => migrateV67ToV68(state as GameStateV67),
  68: (state) => migrateV68ToV69(state as GameStateV68),
  69: (state) => migrateV69ToV70(state as GameStateV69),
  70: (state) => migrateV70ToV71(state as GameStateV70),
  71: (state) => migrateV71ToV72(state as GameStateV71),
  72: (state) => migrateV72ToV73(state as GameStateV72),
  73: (state) => migrateV73ToV74(state as GameStateV73),
  74: (state) => migrateV74ToV75(state as GameStateV74),
};

/**
 * Parse → migrate (v1–current) → validate → return GameState.
 * Does not call serializeGameState.
 */
export function deserializeGameState(stateJson: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stateJson);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Malformed GameState JSON: ${detail}`);
  }

  let envelope: z.infer<typeof gameStateEnvelopeSchema>;
  try {
    envelope = gameStateEnvelopeSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid GameState envelope: ${error.issues.map((issue) => issue.message).join("; ")}`,
      );
    }
    throw error;
  }

  let version = envelope.meta.schemaVersion;

  if (version > GAME_STATE_SCHEMA_VERSION) {
    throw new Error(
      `Save schema version ${version} is newer than the supported version ${GAME_STATE_SCHEMA_VERSION}.\nThis save was created by a newer version of the game.`,
    );
  }

  if (version < 1) {
    throw new Error(
      `Unsupported GameState schemaVersion ${version}; expected a version between 1 and ${GAME_STATE_SCHEMA_VERSION}.`,
    );
  }

  let state: unknown = parsed;
  while (version < GAME_STATE_SCHEMA_VERSION) {
    const migrateStep = MIGRATE_ONE_STEP[version];
    if (!migrateStep) {
      throw new Error(
        `Unsupported GameState schemaVersion ${version}; expected a version between 1 and ${GAME_STATE_SCHEMA_VERSION}.`,
      );
    }
    state = migrateStep(state);
    version += 1;
  }

  const withTradeBlocks = reconcileJerseyNumbers(
    reconcileTradeBlocks(state as GameState),
  );
  validateGameState(withTradeBlocks);
  // Align phase pointer with date/state for saves created before calendar-driven sync.
  const reconciled = reconcilePhaseWithState(withTradeBlocks);
  return reconciled.state;
}
