import Link from "next/link";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { TeamIdentityInline } from "@/components/team/TeamIdentityInline";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, focusRingClass } from "@/components/ui/styles";
import {
  buildLeagueStatsSortHref,
  PLAYER_STATS_PAGE_SIZE,
  type LeagueStatsSort,
  type PlayerStatKey,
  type PlayerStatsView,
  type TeamStatKey,
  type TeamStatsView,
} from "@/state/league-stats-selectors";

type StatColumn<K extends string> = {
  key: K;
  label: string;
  title: string;
  format: "int" | "rate" | "pct" | "winPct" | "signed";
};

const TEAM_COLUMNS: StatColumn<TeamStatKey>[] = [
  { key: "gp", label: "GP", title: "Games played", format: "int" },
  { key: "winPct", label: "PCT", title: "Win percentage", format: "winPct" },
  { key: "ppg", label: "PPG", title: "Points per game", format: "rate" },
  {
    key: "oppPpg",
    label: "OPP",
    title: "Opponent points per game",
    format: "rate",
  },
  {
    key: "net",
    label: "NET",
    title: "Point differential per game",
    format: "signed",
  },
  { key: "fgPct", label: "FG%", title: "Field goal percentage", format: "pct" },
  {
    key: "threePct",
    label: "3P%",
    title: "Three-point percentage",
    format: "pct",
  },
  { key: "ftPct", label: "FT%", title: "Free throw percentage", format: "pct" },
  { key: "rpg", label: "RPG", title: "Rebounds per game", format: "rate" },
  { key: "apg", label: "APG", title: "Assists per game", format: "rate" },
  { key: "spg", label: "SPG", title: "Steals per game", format: "rate" },
  { key: "bpg", label: "BPG", title: "Blocks per game", format: "rate" },
  { key: "tov", label: "TOV", title: "Turnovers per game", format: "rate" },
];

const PLAYER_COLUMNS: StatColumn<PlayerStatKey>[] = [
  { key: "gp", label: "GP", title: "Games played", format: "int" },
  { key: "mpg", label: "MIN", title: "Minutes per game", format: "rate" },
  { key: "ppg", label: "PPG", title: "Points per game", format: "rate" },
  { key: "rpg", label: "RPG", title: "Rebounds per game", format: "rate" },
  { key: "apg", label: "APG", title: "Assists per game", format: "rate" },
  { key: "spg", label: "SPG", title: "Steals per game", format: "rate" },
  { key: "bpg", label: "BPG", title: "Blocks per game", format: "rate" },
  { key: "tov", label: "TOV", title: "Turnovers per game", format: "rate" },
  { key: "fgPct", label: "FG%", title: "Field goal percentage", format: "pct" },
  {
    key: "threePct",
    label: "3P%",
    title: "Three-point percentage",
    format: "pct",
  },
  { key: "ftPct", label: "FT%", title: "Free throw percentage", format: "pct" },
];

function formatStat(
  value: number | null,
  format: StatColumn<string>["format"],
): string {
  if (value == null) {
    return "—";
  }
  switch (format) {
    case "int":
      return String(value);
    case "winPct":
      return value.toFixed(3).replace(/^0/, "");
    case "signed":
      return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
    default:
      return value.toFixed(1);
  }
}

function SortHeader<K extends string>(props: {
  column: StatColumn<K>;
  sort: LeagueStatsSort<K>;
  pathname: string;
  extra?: Record<string, string>;
}) {
  const active = props.sort.key === props.column.key;
  return (
    <th
      scope="col"
      className="px-2 py-2 text-right font-medium"
      aria-sort={
        active
          ? props.sort.dir === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
      data-testid={`league-stats-col-${props.column.key}`}
    >
      <Link
        href={buildLeagueStatsSortHref({
          pathname: props.pathname,
          current: props.sort,
          key: props.column.key,
          extra: props.extra,
        })}
        title={props.column.title}
        scroll={false}
        className={cn(
          "inline-flex min-h-8 items-center gap-0.5 hover:text-zinc-100",
          active && "text-team-ink",
          focusRingClass,
        )}
      >
        {props.column.label}
        {active ? (
          <span aria-hidden>{props.sort.dir === "asc" ? "▲" : "▼"}</span>
        ) : null}
      </Link>
    </th>
  );
}

function statCellClass(active: boolean): string {
  return cn(
    "px-2 py-2 text-right font-mono tabular-nums",
    active ? "text-zinc-50" : "text-zinc-300",
  );
}

export function LeagueTeamStatsTable(props: {
  saveId: string;
  view: TeamStatsView;
}) {
  const { view } = props;
  if (view.gamesPlayed === 0) {
    return <EmptyState message="No regular-season games played yet." />;
  }
  const pathname = `/dashboard/${props.saveId}/league/team-stats`;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <caption className="sr-only">Team stats</caption>
        <thead className="text-zinc-500">
          <tr>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              #
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Team
            </th>
            {TEAM_COLUMNS.map((column) => (
              <SortHeader
                key={column.key}
                column={column}
                sort={view.sort}
                pathname={pathname}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row, index) => (
            <tr
              key={row.teamId}
              className={cn(
                "border-t border-zinc-800",
                row.isUserTeam && "bg-team/15 font-medium",
              )}
            >
              <td className="px-2 py-2 text-right font-mono text-zinc-500">
                {index + 1}
              </td>
              <td className="px-2 py-2">
                <TeamEntityLink
                  saveId={props.saveId}
                  teamId={row.teamId}
                  className="inline-flex items-center gap-2 whitespace-nowrap hover:text-team-ink"
                >
                  <TeamIdentityInline
                    city={row.city}
                    name={row.name}
                    abbreviation={row.abbreviation}
                    branding={row.branding}
                    size="sm"
                  />
                </TeamEntityLink>
              </td>
              {TEAM_COLUMNS.map((column) => (
                <td
                  key={column.key}
                  className={statCellClass(view.sort.key === column.key)}
                >
                  {formatStat(row.values[column.key], column.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LeaguePlayerStatsTable(props: {
  saveId: string;
  view: PlayerStatsView;
}) {
  const { view } = props;
  const pathname = `/dashboard/${props.saveId}/league/player-stats`;
  const extra: Record<string, string> | undefined = view.showAll
    ? { show: "all" }
    : undefined;
  const toggleParams = new URLSearchParams({ sort: view.sort.key });
  toggleParams.set("dir", view.sort.dir);
  if (!view.showAll) {
    toggleParams.set("show", "all");
  }

  if (view.totalQualified === 0) {
    return <EmptyState message="No qualified players yet." />;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <caption className="sr-only">Player stats</caption>
          <thead className="text-zinc-500">
            <tr>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                #
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                Player
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                Team
              </th>
              {PLAYER_COLUMNS.map((column) => (
                <SortHeader
                  key={column.key}
                  column={column}
                  sort={view.sort}
                  pathname={pathname}
                  extra={extra}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row, index) => (
              <tr
                key={row.playerId}
                className={cn(
                  "border-t border-zinc-800",
                  row.isUserTeam && "bg-team/15 font-medium",
                )}
              >
                <td className="px-2 py-2 text-right font-mono text-zinc-500">
                  {index + 1}
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  <PlayerEntityLink
                    saveId={props.saveId}
                    playerId={row.playerId}
                    className="hover:text-team-ink"
                  >
                    {`${row.firstName} ${row.lastName}`.trim()}
                  </PlayerEntityLink>
                </td>
                <td className="px-2 py-2 text-zinc-400">
                  {row.teamId && row.teamAbbreviation ? (
                    <TeamEntityLink
                      saveId={props.saveId}
                      teamId={row.teamId}
                      className="hover:text-team-ink"
                    >
                      {row.teamAbbreviation}
                    </TeamEntityLink>
                  ) : (
                    "—"
                  )}
                </td>
                {PLAYER_COLUMNS.map((column) => (
                  <td
                    key={column.key}
                    className={statCellClass(view.sort.key === column.key)}
                  >
                    {formatStat(row.values[column.key], column.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view.totalQualified > PLAYER_STATS_PAGE_SIZE ? (
        <p className="mt-3 text-sm text-zinc-400">
          {view.showAll
            ? `Showing all ${view.totalQualified} qualified players. `
            : `Showing top ${view.rows.length} of ${view.totalQualified}. `}
          <Link
            href={`${pathname}?${toggleParams.toString()}`}
            scroll={false}
            className={cn(
              "text-team-ink underline-offset-4 hover:underline",
              focusRingClass,
            )}
            data-testid="league-player-stats-toggle"
          >
            {view.showAll ? `Show top ${PLAYER_STATS_PAGE_SIZE}` : "Show all"}
          </Link>
        </p>
      ) : null}
    </>
  );
}
