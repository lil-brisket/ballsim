/** In-save pages under /dashboard/<saveId>, by hub. Static routes only. */
export const SAVE_ROUTES: readonly string[] = [
  // Home
  "",
  "/calendar",
  "/schedule",
  "/notifications",
  "/media",
  // Team
  "/team",
  "/roster",
  "/roster/injuries",
  "/team-management/lineups",
  "/team-management/transactions",
  "/team/contracts",
  "/team/history",
  "/development",
  "/development-league",
  "/staff-coaching/staff",
  "/staff-coaching/coaching",
  "/staff-coaching/hiring-market",
  // League
  "/league",
  "/league/standings",
  "/league/player-stats",
  "/league/team-stats",
  "/league/transactions",
  "/league/expansion",
  "/awards",
  "/history",
  "/history/legacy",
  "/season-events/fan-voting",
  "/season-events/all-star",
  "/playoffs",
  // Front office
  "/finances",
  "/finances/payroll",
  "/finances/activity",
  "/finances/facilities",
  "/franchise",
  "/franchise/ownership",
  "/franchise/history",
  "/business",
  "/sponsorships",
  "/trades/propose",
  "/free-agency",
  // Offseason
  "/offseason",
  "/draft",
  "/draft/lottery",
  "/scouting",
  // Settings
  "/settings",
  "/settings/ai",
  "/settings/rules",
  "/settings/tools",
];

/** Pages outside a save. */
export const OUTER_ROUTES: readonly string[] = [
  "/home",
  "/saves",
  "/new/setup",
  "/dev/broadcast-ui",
];

/**
 * Legacy in-save routes and where they must land (path after the save id).
 * Old bookmarks and stored links (e.g. narrative `/relocation`) rely on these.
 */
export const LEGACY_REDIRECTS: ReadonlyArray<[from: string, to: string]> = [
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
];
