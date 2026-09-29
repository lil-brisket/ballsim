import { describe, expect, it } from "vitest";
import {
  ENGINE_VERSION,
  formatDryRunPreview,
  previewLabGamesRun,
  previewLabScheduleRun,
  previewLabSeasonRun,
} from "@/simulation/lab";

describe("previewLab* dry-run", () => {
  it("resolves game seeds without simulating", () => {
    const preview = previewLabGamesRun({
      seed: 42,
      games: 2,
      scenarioId: "normal",
      rotation: "off",
      persist: false,
    });
    expect(preview.engineVersion).toBe(ENGINE_VERSION);
    expect(preview.mode).toBe("game");
    expect(preview.scenarioVersion).toBe(1);
    expect(preview.seedList).toHaveLength(3);
    expect(preview.persist).toBe(false);
    const text = formatDryRunPreview(preview);
    expect(text).toContain("LAB DRY RUN");
    expect(text).toContain("normal:roster");
    expect(text).toContain("normal:game:0");
  });

  it("previews owner-career and schedule", () => {
    const career = previewLabSeasonRun({ seed: 3, seasons: 2 });
    expect(career.mode).toBe("owner-career");
    expect(career.seasons).toBe(2);
    expect(career.seedList).toHaveLength(1);
    const schedule = previewLabScheduleRun({
      seed: 3,
      preset: "cbl",
      until: "regular",
    });
    expect(schedule.mode).toBe("schedule");
    expect(schedule.until).toBe("regular");
  });
});
