import type { NextConfig } from "next";

/**
 * Retired in-save routes and their canonical pages. Kept as permanent
 * redirects for bookmarks and for links stored in old saves (e.g. narrative
 * actions with `/relocation`). Query strings carry over.
 */
const LEGACY_SAVE_ROUTES: ReadonlyArray<[from: string, to: string]> = [
  ["/transactions", "/league/transactions"],
  ["/standings", "/league/standings"],
  ["/contracts", "/team/contracts"],
  ["/facilities", "/finances/facilities"],
  ["/relocation", "/franchise/relocation"],
  ["/staff", "/staff-coaching/staff"],
  ["/staff-coaching", "/staff-coaching/staff"],
  ["/team-management", "/team"],
  ["/team-management/coaching", "/staff-coaching/coaching"],
  ["/team-management/injuries", "/roster/injuries"],
  ["/team-management/rotations", "/team-management/lineups"],
  ["/team-management/transactions", "/league/transactions?team=my"],
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.0.0.248"],
  async redirects() {
    return LEGACY_SAVE_ROUTES.map(([from, to]) => ({
      source: `/dashboard/:saveId${from}`,
      destination: `/dashboard/:saveId${to}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
