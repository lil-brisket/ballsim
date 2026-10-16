/**
 * Real professional team names a generated league must never produce.
 * Cities and nicknames are paired at random, so fictional pools can still
 * form a real team ("Calgary Flames"). Covers every current and well-known
 * former NBA/WNBA team, plus real teams in other major leagues whose nickname
 * is in TEAM_NICKNAMES. Add an entry when a nickname or city joins a pool and
 * forms a real team.
 *
 * Only generated defaults are checked. Names a user types or imports in a
 * custom roster are theirs to choose.
 */
const RESERVED_TEAM_NAMES = [
  // NBA
  "Atlanta Hawks",
  "Boston Celtics",
  "Brooklyn Nets",
  "Charlotte Hornets",
  "Chicago Bulls",
  "Cleveland Cavaliers",
  "Dallas Mavericks",
  "Denver Nuggets",
  "Detroit Pistons",
  "Golden State Warriors",
  "Houston Rockets",
  "Indiana Pacers",
  "Los Angeles Clippers",
  "Los Angeles Lakers",
  "Memphis Grizzlies",
  "Miami Heat",
  "Milwaukee Bucks",
  "Minnesota Timberwolves",
  "New Orleans Pelicans",
  "New York Knicks",
  "Oklahoma City Thunder",
  "Orlando Magic",
  "Philadelphia 76ers",
  "Phoenix Suns",
  "Portland Trail Blazers",
  "Portland Blazers",
  "Sacramento Kings",
  "San Antonio Spurs",
  "Toronto Raptors",
  "Utah Jazz",
  "Washington Wizards",
  // Former NBA
  "Seattle SuperSonics",
  "Vancouver Grizzlies",
  "New Jersey Nets",
  "Charlotte Bobcats",
  "New Orleans Hornets",
  "Kansas City Kings",
  "San Diego Rockets",
  "San Diego Clippers",
  "Buffalo Braves",
  "Washington Bullets",
  "Baltimore Bullets",
  "St. Louis Hawks",
  "Milwaukee Hawks",
  "Minneapolis Lakers",
  "San Francisco Warriors",
  "Philadelphia Warriors",
  // WNBA, current and former
  "Atlanta Dream",
  "Chicago Sky",
  "Connecticut Sun",
  "Dallas Wings",
  "Golden State Valkyries",
  "Indiana Fever",
  "Las Vegas Aces",
  "Los Angeles Sparks",
  "Minnesota Lynx",
  "New York Liberty",
  "Phoenix Mercury",
  "Portland Fire",
  "Seattle Storm",
  "Toronto Tempo",
  "Washington Mystics",
  "Houston Comets",
  "Sacramento Monarchs",
  "Detroit Shock",
  "Tulsa Shock",
  "Charlotte Sting",
  "Cleveland Rockers",
  "Miami Sol",
  "Utah Starzz",
  "Orlando Miracle",
  "San Antonio Silver Stars",
  // Other leagues, for nicknames in TEAM_NICKNAMES
  "Atlanta Falcons",
  "Philadelphia Eagles",
  "Detroit Lions",
  "Chicago Bears",
  "Jacksonville Jaguars",
  "Los Angeles Chargers",
  "San Diego Chargers",
  "Carolina Panthers",
  "Florida Panthers",
  "Tennessee Titans",
  "Calgary Flames",
  "Atlanta Flames",
  "San Jose Sharks",
  "New York Rangers",
  "Texas Rangers",
  "Colorado Avalanche",
  "Tampa Bay Lightning",
  "Carolina Hurricanes",
  "Arizona Coyotes",
  "Phoenix Coyotes",
  "BC Lions",
  "Rio Grande Valley Vipers",
  "Texas Legends",
] as const;

const RESERVED = new Set(RESERVED_TEAM_NAMES.map((name) => name.toLowerCase()));

/** True when `city nickname` is a real professional team. */
export function isReservedTeamName(city: string, nickname: string): boolean {
  return RESERVED.has(`${city} ${nickname}`.toLowerCase());
}

/**
 * First nickname in `pool` that is not in `usedNicknames` and does not form a
 * real team with `city`. Deterministic (pool order, no RNG). Null when none.
 */
export function firstFictionalNickname(
  city: string,
  pool: readonly string[],
  usedNicknames: ReadonlySet<string>,
): string | null {
  return (
    pool.find(
      (nickname) =>
        !usedNicknames.has(nickname) && !isReservedTeamName(city, nickname),
    ) ?? null
  );
}
