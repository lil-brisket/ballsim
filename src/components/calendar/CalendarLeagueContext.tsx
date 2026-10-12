import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { TickerBar, type TickerItem } from "@/components/ui/TickerBar";
import type { CalendarLeagueContextView } from "@/state/standings-selectors";

export function CalendarLeagueContextPanel(props: {
  context: CalendarLeagueContextView | null;
}) {
  if (!props.context) {
    return (
      <ArenaPanel as="aside" raised>
        <h3 className="font-display text-xl font-bold uppercase tracking-wide text-zinc-50">
          League context
        </h3>
        <p className="mt-2 text-sm text-zinc-400">
          Standings are unavailable for this phase.
        </p>
      </ArenaPanel>
    );
  }

  const c = props.context;
  const items: TickerItem[] = [
    { label: "Conference", value: `#${c.conferenceRank}` },
    { label: "Division", value: `#${c.divisionRank}` },
    { label: "Record", value: `${c.wins}–${c.losses}`, tone: "team" },
    { label: "Conf", value: `${c.conferenceWins}–${c.conferenceLosses}` },
    { label: "Div", value: `${c.divisionWins}–${c.divisionLosses}` },
    {
      label: "Games Back",
      value: c.gamesBack === 0 ? "—" : String(c.gamesBack),
    },
    { label: "Streak", value: c.streakLabel ?? "—" },
  ];

  return (
    <ArenaPanel as="aside" raised density="compact" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl font-bold uppercase tracking-wide text-zinc-50">
          League context
        </h3>
        <p className="text-xs text-zinc-400">
          {c.conferenceName} · {c.divisionName}
        </p>
      </div>
      <TickerBar aria-label="League context" items={items} />
    </ArenaPanel>
  );
}
