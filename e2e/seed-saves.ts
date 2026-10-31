/**
 * Save ids written by `npm run e2e:seed` into prisma/e2e.db. One CBL league,
 * advanced once from a fixed seed and snapshotted at four points.
 */
export const E2E_SAVES = {
  /** About two weeks into the regular season, before the trade deadline. */
  regularSeason: "e2e-regular-season",
  /** Opening playoff round in progress. */
  playoffs: "e2e-playoffs",
  /** Draft phase opened, class generated, no pick made yet. */
  draft: "e2e-draft",
  /**
   * Second day of free agency: development, awards, annual reports and the
   * finished bracket all exist.
   */
  offseason: "e2e-offseason",
} as const;

export type E2ESaveKey = keyof typeof E2E_SAVES;

/** Database the seed writes; the server must run against it for seeded specs. */
export const E2E_DATABASE_URL = "file:./prisma/e2e.db";
