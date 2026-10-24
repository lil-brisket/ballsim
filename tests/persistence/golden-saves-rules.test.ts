import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { deserializeGameState } from "@/persistence/mappers/game-state-mapper";

/**
 * Rules added after a league was created must not change how that league
 * plays: the draft lottery stays off for every league from before v75,
 * restricted free agency is on for everyone (v73), and the luxury tax keeps
 * whatever the league stored (v74). See docs/plans/gm-loops-plan.md.
 */
const FIXTURE_DIR = join(__dirname, "..", "fixtures", "saves");
const LOTTERY_VERSION = 75;

const fixtures = readdirSync(FIXTURE_DIR)
  .filter((name) => /^v\d+(-played)?\.json\.gz$/.test(name))
  .sort();

function load(name: string) {
  const json = gunzipSync(readFileSync(join(FIXTURE_DIR, name))).toString(
    "utf8",
  );
  const raw = JSON.parse(json) as {
    meta: { schemaVersion: number };
    settings?: { financialRules?: { luxuryTaxEnabled?: boolean } };
  };
  return { raw, state: deserializeGameState(json) };
}

describe("rule defaults for old saves", () => {
  it.each(fixtures)("%s keeps the rules it was created with", (name) => {
    const { raw, state } = load(name);
    const lotteryExisted = raw.meta.schemaVersion >= LOTTERY_VERSION;
    if (!lotteryExisted) {
      expect(state.settings.draftLottery.enabled).toBe(false);
    }
    expect(state.settings.offseason.restrictedFreeAgency).toBe(true);
    const storedTax = raw.settings?.financialRules?.luxuryTaxEnabled;
    if (storedTax !== undefined) {
      expect(state.settings.financialRules.luxuryTaxEnabled).toBe(storedTax);
    }
  });
});
