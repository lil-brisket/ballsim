import { describe, expect, it } from "vitest";
import {
  buildLeagueSanityReport,
} from "@/simulation/league-sanity";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("league sanity regression compare helpers", () => {
  it(
    "produces stable checksums suitable for baseline artifacts",
    { timeout: 120_000 },
    () => {
      const report = buildLeagueSanityReport({
        simulations: 2,
        seasonsPerSimulation: 2,
        seed: 7,
        generatedAt: "2026-01-01T00:00:00.000Z",
      });
      expect(report.metadata.resultChecksum).toMatch(/^[0-9a-f]{8}$/);
      expect(report.metadata.simulationConfigHash).toMatch(/^[0-9a-f]{8}$/);

      const path = join(tmpdir(), `league-sanity-baseline-${Date.now()}.json`);
      writeFileSync(path, JSON.stringify(report), "utf8");
      const reloaded = JSON.parse(readFileSync(path, "utf8"));
      expect(reloaded.metadata.resultChecksum).toBe(
        report.metadata.resultChecksum,
      );
      unlinkSync(path);
    },
  );
});
