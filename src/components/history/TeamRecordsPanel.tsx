import Link from "next/link";
import { EmptyState } from "@/components/owner/EmptyState";
import {
  FranchiseHistorySeasonTable,
  FranchiseHistorySummary,
} from "@/components/owner/FranchiseHistorySummary";
import { Section } from "@/components/owner/Section";
import { cn, focusRingClass, panelClass } from "@/components/ui/styles";
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

const TH = "px-3 py-2 font-medium";
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
          <tr>
            <th className={TH}>Team</th>
            <th className={TH}>Titles</th>
            <th className={TH}>Finals Apps</th>
            <th className={TH}>Best Record</th>
            <th className={TH}>Playoff Apps</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr
              key={row.teamId}
              className={cn(
                "border-b border-zinc-900/80",
                row.teamId === props.selectedTeamId && "bg-amber-600/10",
              )}
            >
              <td className={TD}>
                <Link
                  href={historyHubHref(props.saveId, props.route, {
                    tab: "teams",
                    team: row.teamId,
                  })}
                  className={cn(
                    "text-amber-400 hover:underline",
                    focusRingClass,
                  )}
                >
                  {row.teamName}
                </Link>
              </td>
              <td className={TD}>{row.summary.championships}</td>
              <td className={TD}>{row.summary.finalsAppearances}</td>
              <td className={TD}>{formatRecord(row.summary.bestRecord)}</td>
              <td className={TD}>{row.summary.playoffAppearances}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric(props: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        {props.label}
      </p>
      <p className="mt-1 text-lg text-zinc-50">{props.value}</p>
    </div>
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
                  className="rounded-lg border border-zinc-800 px-4 py-3"
                >
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {item.meta}
                  </p>
                  <p className="mt-1 font-medium text-zinc-100">{item.title}</p>
                  <p className="mt-1 text-sm text-zinc-400">{item.summary}</p>
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
