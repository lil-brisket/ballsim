import type { CalendarLeagueContextView } from "@/state/standings-selectors";

export function CalendarLeagueContextPanel(props: {
  context: CalendarLeagueContextView | null;
}) {
  if (!props.context) {
    return (
      <aside className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
        <h3 className="text-sm font-medium text-zinc-100">League context</h3>
        <p className="mt-2 text-sm text-zinc-500">
          Standings are unavailable for this phase.
        </p>
      </aside>
    );
  }

  const c = props.context;
  const rows: { label: string; value: string }[] = [
    { label: "Conference", value: `#${c.conferenceRank}` },
    { label: "Division", value: `#${c.divisionRank}` },
    { label: "Record", value: `${c.wins}–${c.losses}` },
    { label: "Conf", value: `${c.conferenceWins}–${c.conferenceLosses}` },
    { label: "Div", value: `${c.divisionWins}–${c.divisionLosses}` },
    {
      label: "Games Back",
      value: c.gamesBack === 0 ? "—" : String(c.gamesBack),
    },
    { label: "Streak", value: c.streakLabel ?? "—" },
  ];

  return (
    <aside className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <h3 className="text-sm font-medium text-zinc-100">League context</h3>
      <p className="mt-1 text-xs text-zinc-500">
        {c.conferenceName} · {c.divisionName}
      </p>
      <dl className="mt-3 space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <dt className="text-zinc-500">{row.label}</dt>
            <dd className="font-mono text-zinc-100">{row.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
