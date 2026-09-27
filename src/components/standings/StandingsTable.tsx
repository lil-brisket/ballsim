import type { ReactNode } from "react";
import { takeOverFranchiseAction } from "@/application/actions";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { TeamIdentityInline } from "@/components/team/TeamIdentityInline";
import { cn } from "@/components/ui/styles";
import {
  formatStreak,
  type StandingsGroup,
  type StandingsPageView,
  type StandingsRowEnriched,
} from "@/state/standings-selectors";
import type { StandingsStatsMode } from "@/state/standings-page-params";

function playoffLabelText(label: string): string | null {
  switch (label) {
    case "clinched":
      return "Clinched";
    case "playoff":
      return "Playoff";
    case "play_in":
      return "Play-in";
    case "bubble":
      return "Bubble";
    default:
      return null;
  }
}

function formatPct(winPercentage: number): string {
  return winPercentage.toFixed(3).replace(/^0/, "");
}

function formatGb(gamesBack: number): string {
  return gamesBack === 0 ? "—" : String(gamesBack);
}

function formatRate(value: number | null): string {
  return value == null ? "—" : value.toFixed(1);
}

function displayedRank(row: StandingsRowEnriched, kind: StandingsGroup["kind"]): number {
  if (kind === "overall") {
    return row.leagueRank;
  }
  if (kind === "division") {
    return row.divisionRank;
  }
  return row.conferenceRank;
}

function displayedGb(row: StandingsRowEnriched, kind: StandingsGroup["kind"]): number {
  if (kind === "overall") {
    return row.gamesBackLeague;
  }
  if (kind === "division") {
    return row.gamesBackDivision;
  }
  return row.gamesBackConference;
}

type Column = {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: StandingsRowEnriched) => ReactNode;
};

function columnsFor(
  group: StandingsGroup,
  stats: StandingsStatsMode,
  saveId: string,
  ownedIds: Set<string>,
): Column[] {
  const cols: Column[] = [
    {
      key: "rank",
      label: "#",
      render: (row) => displayedRank(row, group.kind),
    },
    {
      key: "team",
      label: "Team",
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          <TeamEntityLink
            saveId={saveId}
            teamId={row.teamId}
            className="inline-flex items-center gap-2 hover:text-amber-400"
          >
            <TeamIdentityInline
              city={row.city}
              name={row.name}
              abbreviation={row.abbreviation}
              branding={row.branding}
              size="sm"
            />
          </TeamEntityLink>
          {row.isUserTeam ? (
            <span className="text-amber-400">— you</span>
          ) : null}
        </span>
      ),
    },
  ];

  if (stats === "standard") {
    cols.push(
      { key: "w", label: "W", render: (row) => row.wins },
      { key: "l", label: "L", render: (row) => row.losses },
      {
        key: "pct",
        label: "PCT",
        render: (row) => (
          <span className="text-zinc-400">{formatPct(row.winPercentage)}</span>
        ),
      },
      {
        key: "gb",
        label: "GB",
        render: (row) => (
          <span className="text-zinc-400">
            {formatGb(displayedGb(row, group.kind))}
          </span>
        ),
      },
      {
        key: "str",
        label: "Str",
        render: (row) => (
          <span className="text-zinc-500">{formatStreak(row.streak)}</span>
        ),
      },
    );
  } else {
    cols.push(
      {
        key: "ppg",
        label: "PPG",
        render: (row) => formatRate(row.ppg),
      },
      {
        key: "oppPpg",
        label: "Opp PPG",
        render: (row) => formatRate(row.oppPpg),
      },
      {
        key: "net",
        label: "NET",
        render: (row) => formatRate(row.net),
      },
      {
        key: "ortg",
        label: "ORTG",
        render: () => (
          <span title="Season possessions are not tracked">—</span>
        ),
      },
      {
        key: "drtg",
        label: "DRTG",
        render: () => (
          <span title="Season possessions are not tracked">—</span>
        ),
      },
    );
  }

  cols.push(
    {
      key: "label",
      label: " ",
      render: (row) => (
        <span className="text-xs text-zinc-500">
          {playoffLabelText(row.playoffLabel)}
        </span>
      ),
    },
    {
      key: "action",
      label: " ",
      align: "right",
      render: (row) =>
        ownedIds.has(row.teamId) ? null : (
          <form action={takeOverFranchiseAction}>
            <input type="hidden" name="saveId" value={saveId} />
            <input type="hidden" name="teamId" value={row.teamId} />
            <button
              type="submit"
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-amber-600 hover:text-amber-300"
            >
              Take Over
            </button>
          </form>
        ),
    },
  );

  return cols;
}

export function StandingsTable(props: {
  saveId: string;
  group: StandingsGroup;
  page: Pick<StandingsPageView, "mode" | "stats" | "playoffTeamCount" | "ownedTeamIds">;
}) {
  const ownedIds = new Set(props.page.ownedTeamIds);
  const columns = columnsFor(
    props.group,
    props.page.stats,
    props.saveId,
    ownedIds,
  );
  const minWidth =
    props.page.stats === "advanced" ? "min-w-[48rem]" : "min-w-[36rem]";
  const showCutoffLine =
    props.group.kind === "overall" &&
    props.page.mode === "regular" &&
    props.group.cutoffRank != null;

  return (
    <section aria-label={props.group.name}>
      {props.group.kind === "overall" ? null : (
        <h2 className="mb-2 text-sm font-medium text-zinc-200">
          {props.group.name}
        </h2>
      )}
      <div className="overflow-x-auto">
        <table className={cn("w-full text-left text-sm", minWidth)}>
          <thead className="text-zinc-500">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2 font-medium",
                    col.align === "right" && "text-right",
                  )}
                  data-testid={`standings-col-${col.key}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.group.rows.map((row) => {
              const rank = displayedRank(row, props.group.kind);
              const cutoff =
                showCutoffLine && rank === props.group.cutoffRank;
              return (
                <tr
                  key={row.teamId}
                  className={cn(
                    "border-t border-zinc-800",
                    row.isUserTeam &&
                      "bg-amber-950/30 font-medium text-amber-300",
                    cutoff && "border-t border-dashed border-amber-700/60",
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-3 py-2",
                        col.key === "rank"
                          ? "font-mono text-zinc-500"
                          : col.key !== "team" && col.key !== "label" && col.key !== "action"
                            ? "font-mono"
                            : null,
                        col.align === "right" && "text-right",
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showCutoffLine && props.group.cutoffRank != null ? (
        <p className="mt-1 text-xs text-zinc-600">
          {`Playoff cutoff at rank ${props.group.cutoffRank} (league-wide field of ${props.page.playoffTeamCount}).`}
        </p>
      ) : null}
      {props.group.kind !== "overall" ? (
        <p className="mt-1 text-xs text-zinc-600">
          {`Playoff qualification is league-wide (top ${props.page.playoffTeamCount}).`}
        </p>
      ) : null}
    </section>
  );
}
