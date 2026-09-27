import { Metric } from "@/components/ui/Metric";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, densityGap } from "@/components/ui/styles";

export function DlPipelineSection(props: { children: React.ReactNode }) {
  return <div data-testid="dl-pipeline">{props.children}</div>;
}

export function DlAssignSection(props: { children: React.ReactNode }) {
  return (
    <div
      data-testid="dl-assign"
      className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 text-zinc-500"
    >
      {props.children}
    </div>
  );
}

export function DlPipelineSummary(props: {
  record: { wins: number; losses: number } | null;
  assignedCount: number;
  ready: number;
  nearReady: number;
  developing: number;
  leagueRank?: number | null;
  streakLabel?: string | null;
}) {
  const recordValue = props.record
    ? `${props.record.wins}–${props.record.losses}`
    : "—";

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5", densityGap.default)}>
      <StatCard label="Record" value={recordValue} mono density="compact" />
      <StatCard label="Assigned" value={props.assignedCount} mono density="compact" />
      <StatCard
        label="Ready"
        value={
          <span className="flex items-center gap-2">
            {props.ready}
            <StatusBadge label="Ready" tone="success" />
          </span>
        }
        density="compact"
      />
      <StatCard
        label="Near Ready"
        value={
          <span className="flex items-center gap-2">
            {props.nearReady}
            <StatusBadge label="Near Ready" tone="warning" />
          </span>
        }
        density="compact"
      />
      <StatCard
        label="Developing"
        value={
          <span className="flex items-center gap-2">
            {props.developing}
            <StatusBadge label="Developing" tone="neutral" />
          </span>
        }
        density="compact"
      />
      {props.leagueRank != null || props.streakLabel ? (
        <div className="col-span-2 flex flex-wrap gap-4 sm:col-span-3 lg:col-span-5">
          {props.leagueRank != null ? (
            <Metric label="DL Rank" value={`#${props.leagueRank}`} mono density="compact" />
          ) : null}
          {props.streakLabel ? (
            <Metric label="Streak" value={props.streakLabel} mono density="compact" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
