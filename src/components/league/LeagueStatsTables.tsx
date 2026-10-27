import Link from "next/link";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { TeamIdentityInline } from "@/components/team/TeamIdentityInline";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  DataTable,
  numericCellClass,
  type DataTableHeader,
} from "@/components/ui/DataTable";
import {
  cn,
  focusRingClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
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

function sortHeader<K extends string>(props: {
  column: StatColumn<K>;
  sort: LeagueStatsSort<K>;
  pathname: string;
  extra?: Record<string, string>;
}): DataTableHeader {
  const active = props.sort.key === props.column.key;
  return {
    label: props.column.label,
    numeric: true,
    sort: {
      href: buildLeagueStatsSortHref({
        pathname: props.pathname,
        current: props.sort,
        key: props.column.key,
        extra: props.extra,
      }),
      direction: active ? props.sort.dir : null,
    },
  };
}

/** Inset team bar: survives the table zebra and the focused-row fill. */
const userRowClass =
  "font-medium shadow-[inset_3px_0_0_0_rgb(var(--team-ink-rgb))]";

function statCellClass(active: boolean): string {
  return cn(
    "px-3 py-2 font-mono",
    numericCellClass,
    active ? "text-ink" : "text-soft",
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
    <DataTable
      caption="Team stats"
      headers={[
        { label: "#", numeric: true },
        "Team",
        ...TEAM_COLUMNS.map((column) =>
          sortHeader({ column, sort: view.sort, pathname }),
        ),
      ]}
    >
      {view.rows.map((row, index) => (
        <tr key={row.teamId} className={cn(row.isUserTeam && userRowClass)}>
          <td
            className={cn("px-3 py-2 font-mono text-faint", numericCellClass)}
          >
            {index + 1}
          </td>
          <td className="px-3 py-2">
            <TeamEntityLink
              saveId={props.saveId}
              teamId={row.teamId}
              className={cn(
                "-my-2 inline-flex min-h-11 items-center gap-2 whitespace-nowrap hover:text-team-ink",
                focusRingClass,
              )}
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
    </DataTable>
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
      <DataTable
        caption="Player stats"
        headers={[
          { label: "#", numeric: true },
          "Player",
          "Team",
          ...PLAYER_COLUMNS.map((column) =>
            sortHeader({ column, sort: view.sort, pathname, extra }),
          ),
        ]}
      >
        {view.rows.map((row, index) => (
          <tr key={row.playerId} className={cn(row.isUserTeam && userRowClass)}>
            <td
              className={cn("px-3 py-2 font-mono text-faint", numericCellClass)}
            >
              {index + 1}
            </td>
            <td className="whitespace-nowrap px-3 py-2">
              <PlayerEntityLink
                saveId={props.saveId}
                playerId={row.playerId}
                className={cn(
                  "-my-2 inline-flex min-h-11 items-center hover:text-team-ink",
                  focusRingClass,
                )}
              >
                {`${row.firstName} ${row.lastName}`.trim()}
              </PlayerEntityLink>
            </td>
            <td className="px-3 py-2 text-muted">
              {row.teamId && row.teamAbbreviation ? (
                <TeamEntityLink
                  saveId={props.saveId}
                  teamId={row.teamId}
                  className={cn(
                    "-my-2 inline-flex min-h-11 items-center hover:text-team-ink",
                    focusRingClass,
                  )}
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
      </DataTable>
      {view.totalQualified > PLAYER_STATS_PAGE_SIZE ? (
        <p className="mt-3 text-sm text-muted">
          {view.showAll
            ? `Showing all ${view.totalQualified} qualified players. `
            : `Showing top ${view.rows.length} of ${view.totalQualified}. `}
          <Link
            href={`${pathname}?${toggleParams.toString()}`}
            scroll={false}
            className={cn(
              touchTargetTextClass,
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
