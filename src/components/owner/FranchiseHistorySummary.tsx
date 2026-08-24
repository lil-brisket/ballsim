import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import type {
  FranchiseHistorySeasonRow,
  FranchiseHistoryView,
} from "@/state/franchise-selectors";
import type {
  BestRecordMetric,
  HistoricalHighlight,
  SeasonMetric,
} from "@/state/franchise-history-milestones";

const HIGHLIGHT_LABELS: Record<HistoricalHighlight, string> = {
  championship: "Championship",
  best_record: "Best record",
  highest_franchise_value: "Highest value",
  highest_attendance: "Highest attendance",
  first_playoff: "First playoff",
  first_championship: "First championship",
};

function formatAttendance(attendance: number | null): string {
  if (attendance === null) {
    return "—";
  }
  return attendance.toLocaleString();
}

function SummaryMetric(props: {
  label: string;
  value: React.ReactNode;
  detail?: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        {props.label}
      </p>
      <p className="mt-1 text-lg text-zinc-50">{props.value}</p>
      {props.detail ? (
        <p className="mt-0.5 text-xs text-zinc-500">{props.detail}</p>
      ) : null}
    </div>
  );
}

function formatBestRecord(record: BestRecordMetric | null): {
  value: string;
  detail: string | null;
} {
  if (!record) {
    return { value: "—", detail: null };
  }
  return {
    value: `${record.wins}-${record.losses}`,
    detail: String(record.seasonYear),
  };
}

function formatSeasonMetric(
  metric: SeasonMetric | null,
  money: boolean,
): { value: React.ReactNode; detail: string | null } {
  if (!metric) {
    return { value: "—", detail: null };
  }
  return {
    value: money ? (
      <MoneyDisplay amount={metric.value} />
    ) : (
      metric.value.toLocaleString()
    ),
    detail: String(metric.seasonYear),
  };
}

export function FranchiseHistorySummary(props: {
  view: FranchiseHistoryView;
}) {
  const { milestones, ownerTenureYears } = props.view;
  const best = formatBestRecord(milestones.bestRecord);
  const highestValue = formatSeasonMetric(
    milestones.highestFranchiseValue,
    true,
  );
  const highestAttendance = formatSeasonMetric(
    milestones.highestAttendance,
    false,
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SummaryMetric
        label="Championships"
        value={milestones.championships}
      />
      <SummaryMetric
        label="Playoff appearances"
        value={milestones.playoffAppearances}
      />
      <SummaryMetric label="Best record" value={best.value} detail={best.detail} />
      <SummaryMetric
        label="Highest franchise value"
        value={highestValue.value}
        detail={highestValue.detail}
      />
      <SummaryMetric
        label="Highest attendance"
        value={highestAttendance.value}
        detail={highestAttendance.detail}
      />
      <SummaryMetric
        label="Years under current ownership"
        value={ownerTenureYears}
      />
    </div>
  );
}

function SeasonHighlightList(props: { highlights: HistoricalHighlight[] }) {
  if (props.highlights.length === 0) {
    return null;
  }
  return (
    <ul className="mt-1 flex flex-wrap gap-1">
      {props.highlights.map((highlight) => (
        <li
          key={highlight}
          className="text-[10px] uppercase tracking-wide text-zinc-500"
        >
          {HIGHLIGHT_LABELS[highlight]}
        </li>
      ))}
    </ul>
  );
}

export function FranchiseHistorySeasonTable(props: {
  seasons: FranchiseHistorySeasonRow[];
}) {
  if (props.seasons.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-800 text-zinc-400">
          <tr>
            <th className="px-3 py-2">Year</th>
            <th className="px-3 py-2">Record</th>
            <th className="px-3 py-2">Playoffs</th>
            <th className="px-3 py-2">Revenue</th>
            <th className="px-3 py-2">Sentiment</th>
            <th className="px-3 py-2">Reputation</th>
            <th className="px-3 py-2">Value</th>
            <th className="px-3 py-2">Attendance</th>
          </tr>
        </thead>
        <tbody>
          {[...props.seasons].reverse().map((season) => (
            <tr
              key={season.seasonId}
              className="border-b border-zinc-900 text-zinc-200"
            >
              <td className="px-3 py-2 align-top">
                <div>{season.seasonYear}</div>
                <SeasonHighlightList highlights={season.highlights} />
              </td>
              <td className="px-3 py-2 align-top">
                {season.wins}-{season.losses}
              </td>
              <td className="px-3 py-2 align-top">{season.playoffLabel}</td>
              <td className="px-3 py-2 align-top">
                <MoneyDisplay amount={season.revenue} />
              </td>
              <td className="px-3 py-2 align-top">{season.fanSentiment}</td>
              <td className="px-3 py-2 align-top">{season.reputation}</td>
              <td className="px-3 py-2 align-top">
                <MoneyDisplay amount={season.franchiseValue} />
              </td>
              <td className="px-3 py-2 align-top">
                {formatAttendance(season.attendance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
