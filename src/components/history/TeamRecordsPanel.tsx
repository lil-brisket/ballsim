import Link from "next/link";
import { DataTable, numericCellClass } from "@/components/ui/DataTable";
import { Metric } from "@/components/ui/Metric";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  FranchiseHistorySeasonTable,
  FranchiseHistorySummary,
} from "@/components/owner/FranchiseHistorySummary";
import { Section } from "@/components/ui/Section";
import {
  cn,
  focusRingClass,
  linkClass,
  panelClass,
} from "@/components/ui/styles";
import { historyHubHref } from "@/components/history/history-hub-links";
import type { BestRecordMetric } from "@/state/franchise-history-milestones";
import type {
  FranchiseHistoryView,
  TeamHistoryView,
  TeamRecordsRow,
} from "@/state/franchise-selectors";
import type {
  HistoryHubRoute,
  OwnerStoryItem,
} from "@/state/history-hub-selectors";

const TD = "px-3 py-2";

function formatRecord(record: BestRecordMetric | null): string {
  return record
    ? `${record.wins}-${record.losses} (${record.seasonYear})`
    : "—";
}

function TeamRecordsTable(props: {
  saveId: string;
  route: HistoryHubRoute;
  rows: TeamRecordsRow[];
  selectedTeamId: string | null;
}) {
  return (
    <DataTable
      caption="All-time team records"
      headers={[
        "Team",
        { label: "Titles", numeric: true },
        { label: "Finals Apps", numeric: true },
        { label: "Best Record", numeric: true },
        { label: "Playoff Apps", numeric: true },
      ]}
    >
      {props.rows.map((row) => (
        <tr
          key={row.teamId}
          aria-selected={row.teamId === props.selectedTeamId ? true : undefined}
          className={cn(
            row.teamId === props.selectedTeamId &&
              "shadow-[inset_3px_0_0_0_rgb(var(--team-ink-rgb))]",
          )}
        >
          <td className={TD}>
            <Link
              href={historyHubHref(props.saveId, props.route, {
                tab: "teams",
                team: row.teamId,
              })}
              className={cn(
                linkClass,
                "inline-flex min-h-11 items-center",
                focusRingClass,
              )}
            >
              {row.teamName}
            </Link>
          </td>
          <td className={cn(TD, numericCellClass)}>
            {row.summary.championships}
          </td>
          <td className={cn(TD, numericCellClass)}>
            {row.summary.finalsAppearances}
          </td>
          <td className={cn(TD, numericCellClass)}>
            {formatRecord(row.summary.bestRecord)}
          </td>
          <td className={cn(TD, numericCellClass)}>
            {row.summary.playoffAppearances}
          </td>
        </tr>
      ))}
    </DataTable>
  );
}

function TeamHistoryDetail(props: {
  team: TeamHistoryView;
  ownerFranchise: FranchiseHistoryView | null;
  ownerStory: OwnerStoryItem[] | null;
}) {
  const { team } = props;
  const { summary } = team;
  return (
    <div className="space-y-6">
      <Section title={team.teamName}>
        {!team.hasHistory ? (
          <EmptyState message="No completed seasons yet." />
        ) : (
          <div
            className={cn(
              panelClass,
              "grid gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4",
            )}
          >
            <Metric
              label="All-time record"
              value={`${summary.wins}-${summary.losses}`}
            />
            <Metric label="Seasons" value={summary.totalSeasons} />
            <Metric label="Championships" value={summary.championships} />
            <Metric
              label="Finals appearances"
              value={summary.finalsAppearances}
            />
            <Metric
              label="Playoff appearances"
              value={summary.playoffAppearances}
            />
            <Metric
              label="Best season"
              value={formatRecord(summary.bestRecord)}
            />
            <Metric
              label="Worst season"
              value={formatRecord(summary.worstRecord)}
            />
          </div>
        )}
      </Section>

      {props.ownerFranchise ? (
        <Section title="Franchise summary">
          <FranchiseHistorySummary view={props.ownerFranchise} />
        </Section>
      ) : null}

      {team.hasHistory ? (
        <Section title="Season records">
          <FranchiseHistorySeasonTable seasons={team.seasons} />
        </Section>
      ) : null}

      {props.ownerStory ? (
        <Section title="Franchise story">
          {props.ownerStory.length === 0 ? (
            <EmptyState message="No narrative developments recorded yet." />
          ) : (
            <ul className="space-y-3">
              {props.ownerStory.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-line px-4 py-3"
                >
                  <p className="text-sm text-muted">{item.meta}</p>
                  <p className="mt-1 font-medium text-ink">{item.title}</p>
                  <p className="mt-1 text-sm text-muted">{item.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}
    </div>
  );
}

export function TeamRecordsPanel(props: {
  saveId: string;
  route: HistoryHubRoute;
  rows: TeamRecordsRow[];
  selectedTeam: TeamHistoryView | null;
  ownerFranchise: FranchiseHistoryView | null;
  ownerStory: OwnerStoryItem[] | null;
}) {
  return (
    <div className="space-y-8">
      <Section title="All-time team records">
        {props.rows.length === 0 ? (
          <EmptyState message="No completed seasons yet." />
        ) : (
          <TeamRecordsTable
            saveId={props.saveId}
            route={props.route}
            rows={props.rows}
            selectedTeamId={props.selectedTeam?.teamId ?? null}
          />
        )}
      </Section>
      {props.selectedTeam ? (
        <TeamHistoryDetail
          team={props.selectedTeam}
          ownerFranchise={props.ownerFranchise}
          ownerStory={props.ownerStory}
        />
      ) : null}
    </div>
  );
}
