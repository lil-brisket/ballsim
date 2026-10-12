import { describe, expect, it } from "vitest";
import { ratingTier } from "@/presentation/rating-tier";

describe("ratingTier", () => {
  it.each([
    [99, "elite"],
    [90, "elite"],
    [89, "star"],
    [80, "star"],
    [79, "starter"],
    [70, "starter"],
    [69, "role"],
    [60, "role"],
    [59, "bench"],
    [0, "bench"],
    [-5, "bench"],
  ])("maps %i to %s", (overall, id) => {
    expect(ratingTier(overall).id).toBe(id);
  });
});
