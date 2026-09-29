import packageJson from "../../../package.json";
import { hashPayload } from "@/simulation/analytics/hash";
import { HARD_GAME_RULE_IDS } from "@/simulation/lab/invariant-registry";
import type { EngineIdentity } from "@/simulation/lab/types";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { PLAUSIBILITY_BANDS } from "@/simulation/validation/plausibility";

export function readEngineIdentity(): EngineIdentity {
  return {
    packageVersion: packageJson.version,
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    gameInvariantsChecksum: hashPayload([...HARD_GAME_RULE_IDS].sort()),
    plausibilityChecksum: hashPayload(PLAUSIBILITY_BANDS),
  };
}
