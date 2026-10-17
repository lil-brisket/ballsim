import type { ReactNode } from "react";
import { buttonClass } from "@/components/ui/Button";
import { takeOverFranchiseAction } from "@/application/actions";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { TeamIdentityInline } from "@/components/team/TeamIdentityInline";
import { MobileListCard } from "@/components/ui/MobileListCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
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

function displayedRank(
  row: StandingsRowEnriched,
  kind: StandingsGroup["kind"],
): number {
  if (kind === "overall") {
    return row.leagueRank;
  }
  if (kind === "division") {
    return row.divisionRank;
  }
  return row.conferenceRank;
}

function displayedGb(
  row: StandingsRowEnriched,
  kind: StandingsGroup["kind"],
): number {
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
            className="inline-flex items-center gap-2 hover:text-team-ink"
          >
            <TeamIdentityInline
              city={row.city}
              name={row.name}
              abbreviation={row.abbreviation}
              branding={row.branding}
              size="sm"
            />
          </TeamEntityLink>
          {row.isUserTeam ? <span className="text-team-ink">— you</span> : null}
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
        render: () => <span title="Season possessions are not tracked">—</span>,
      },
      {
        key: "drtg",
        label: "DRTG",
        render: () => <span title="Season possessions are not tracked">—</span>,
      },
    );
  }

  cols.push(
    {
      key: "label",
      label: " ",
      render: (row) => (
        <span className="text-sm text-zinc-500">
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
              className={buttonClass({ variant: "secondary" })}
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
  page: Pick<
    StandingsPageView,
    "mode" | "stats" | "playoffTeamCount" | "ownedTeamIds"
  >;
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
        <SectionHeading className="mb-2" title={props.group.name} />
      )}
      <ul className="flex flex-col gap-2 md:hidden">
        {props.group.rows.map((row) => {
          const rank = displayedRank(row, props.group.kind);
          const playoff = playoffLabelText(row.playoffLabel);
          const statsLine =
            props.page.stats === "advanced"
              ? `PPG ${formatRate(row.ppg)} · NET ${formatRate(row.net)}`
              : `${row.wins}–${row.losses} · GB ${formatGb(displayedGb(row, props.group.kind))}`;
          return (
            <li key={row.teamId}>
              <MobileListCard
                className={
                  row.isUserTeam ? "border-team-ink/50 bg-team/15" : undefined
                }
                title={
                  <TeamEntityLink
                    saveId={props.saveId}
                    teamId={row.teamId}
                    className="inline-flex min-h-11 items-center gap-2 hover:text-team-ink"
                  >
                    <span className="font-mono text-zinc-500">#{rank}</span>
                    <TeamIdentityInline
                      city={row.city}
                      name={row.name}
                      abbreviation={row.abbreviation}
                      branding={row.branding}
                      size="sm"
                    />
                  </TeamEntityLink>
                }
                subtitle={
                  row.isUserTeam
                    ? `${statsLine} · you`
                    : playoff
                      ? `${statsLine} · ${playoff}`
                      : statsLine
                }
                action={
                  ownedIds.has(row.teamId) ? null : (
                    <form action={takeOverFranchiseAction}>
                      <input type="hidden" name="saveId" value={props.saveId} />
                      <input type="hidden" name="teamId" value={row.teamId} />
                      <button
                        type="submit"
                        className={buttonClass({ variant: "secondary" })}
                      >
                        Take Over
                      </button>
                    </form>
                  )
                }
              />
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto md:block">
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
              const cutoff = showCutoffLine && rank === props.group.cutoffRank;
              return (
                <tr
                  key={row.teamId}
                  className={cn(
                    "border-t border-zinc-800",
                    row.isUserTeam && "bg-team/15 font-medium text-team-ink",
                    cutoff && "border-t border-dashed border-team-ink/60",
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-3 py-2",
                        col.key === "rank"
                          ? "font-mono text-zinc-500"
                          : col.key !== "team" &&
                              col.key !== "label" &&
                              col.key !== "action"
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
