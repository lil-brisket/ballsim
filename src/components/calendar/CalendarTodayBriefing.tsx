import type { CalendarTodayBriefing as CalendarTodayBriefingData } from "@/systems/calendar";
import { StatusBadge } from "@/components/owner/StatusBadge";

function BriefingList(props: {
  label: string;
  empty: string;
  items: readonly { id: string; title: string; lifecycle: string }[];
}) {
  if (props.items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        {props.label}: {props.empty}
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        {props.label}
      </p>
      <ul className="space-y-1">
        {props.items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-2 text-sm text-zinc-200"
          >
            <span>{item.title}</span>
            {item.lifecycle === "action_required" ? (
              <StatusBadge label="Action Required" tone="warning" />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Presentational today briefing — operational snapshot for the current world date.
 */
export function CalendarTodayBriefing(props: {
  briefing: CalendarTodayBriefingData;
}) {
  const { briefing } = props;

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium text-zinc-100">Today</h2>
        <p className="font-mono text-sm text-amber-400/90">{briefing.date}</p>
      </div>

      {briefing.actionRequired.length > 0 ? (
        <div className="rounded-md border border-amber-700/40 bg-amber-950/30 px-3 py-2">
          <BriefingList
            label="Action required"
            empty="None"
            items={briefing.actionRequired}
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-300">
            {briefing.yourTeam.teamName}
          </p>
          <BriefingList
            label="Games"
            empty="No team games today"
            items={briefing.yourTeam.games}
          />
          <BriefingList
            label="Injuries"
            empty="No injury updates"
            items={briefing.yourTeam.injuries}
          />
          <BriefingList
            label="Other"
            empty="Nothing else on the board"
            items={briefing.yourTeam.other}
          />
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-300">League</p>
          <p className="text-sm text-zinc-400">
            Games scheduled:{" "}
            <span className="font-mono text-zinc-200">
              {briefing.league.gamesScheduled}
            </span>
          </p>
          <BriefingList
            label="Notable transactions"
            empty="None"
            items={briefing.league.notableTransactions}
          />
          <BriefingList
            label="Deadlines"
            empty="None today"
            items={briefing.league.deadlines}
          />
          <BriefingList
            label="Other"
            empty="Quiet day"
            items={briefing.league.other}
          />
        </div>
      </div>
    </div>
  );
}
