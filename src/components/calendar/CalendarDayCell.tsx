import type { CalendarDayCell as CalendarDayCellData } from "@/systems/calendar";

function dayNumber(isoDate: string): string {
  return String(Number(isoDate.slice(8, 10)));
}

export function formatShortDate(isoDate: string): string {
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[month - 1]} ${day}`;
}

function LeagueMilestoneChips(props: {
  milestones: CalendarDayCellData["leagueMilestones"];
}) {
  if (props.milestones.length === 0) {
    return null;
  }

  const visible = props.milestones.slice(0, 2);
  const hiddenCount = props.milestones.length - visible.length;

  return (
    <div className="flex flex-wrap gap-0.5">
      {visible.map((milestone) => (
        <span
          key={milestone.key}
          title={milestone.label}
          className={[
            "inline-block max-w-full truncate rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:text-[10px]",
            milestone.chipClass,
            milestone.reached && !milestone.active ? "opacity-70" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {milestone.shortLabel}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span
          className="inline-block rounded bg-zinc-800 px-1 py-0.5 text-[9px] font-medium text-zinc-400 sm:text-[10px]"
          title={props.milestones
            .slice(2)
            .map((milestone) => milestone.label)
            .join(", ")}
        >
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

export function CalendarDayCell(props: {
  cell: CalendarDayCellData;
  selected: boolean;
  disabled?: boolean;
  onSelect: (date: string) => void;
}) {
  const { cell, selected, onSelect } = props;
  const disabled = props.disabled === true;
  const teamGame = cell.teamGame;
  const specialCount = cell.specialEvents.length;
  const milestoneCount = (cell.leagueMilestones ?? []).length;

  const ariaParts = [
    cell.date,
    cell.isToday ? "current simulation date" : null,
    cell.isNextTeamGame ? "next team game" : null,
    teamGame
      ? `${teamGame.homeAwayLabel} vs ${teamGame.opponentName}${
          teamGame.resultLabel ? ` ${teamGame.resultLabel}` : ""
        }`
      : null,
    ...(cell.leagueMilestones ?? []).map((milestone) => milestone.label),
    specialCount > 0 ? `${specialCount} special events` : null,
  ];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!disabled) onSelect(cell.date);
      }}
      aria-label={ariaParts.filter(Boolean).join(", ")}
      aria-pressed={selected}
      className={[
        "flex min-h-[5.5rem] flex-col gap-1 rounded-md border p-1.5 text-left transition-colors sm:min-h-[6.75rem] sm:p-2",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
        cell.inMonth
          ? "border-zinc-800 bg-zinc-950/50"
          : "border-zinc-900/80 bg-zinc-950/20",
        cell.isToday ? "border-amber-500 bg-amber-950/40" : "",
        cell.isNextTeamGame && !cell.isToday
          ? "border-sky-700/50 ring-2 ring-sky-500/70"
          : "",
        selected ? "ring-2 ring-amber-500/80" : "hover:border-zinc-600",
        cell.isPast && !cell.isToday ? "opacity-75" : "",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={[
          "font-mono text-xs sm:text-sm",
          cell.inMonth ? "text-zinc-200" : "text-zinc-600",
          cell.isToday ? "font-semibold text-amber-300" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {dayNumber(cell.date)}
      </span>

      <LeagueMilestoneChips milestones={cell.leagueMilestones ?? []} />

      {teamGame ? (
        <div className="mt-auto space-y-0.5">
          <span
            className={[
              "inline-block rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              teamGame.home
                ? "bg-emerald-950/60 text-emerald-300"
                : "bg-sky-950/60 text-sky-300",
            ].join(" ")}
          >
            {teamGame.homeAwayLabel}
          </span>
          <p className="truncate font-mono text-[11px] font-medium text-zinc-100 sm:text-xs">
            {teamGame.opponentAbbreviation}
          </p>
          <p className="hidden truncate text-[10px] text-zinc-400 sm:block">
            {teamGame.opponentName}
          </p>
          {teamGame.resultLabel ? (
            <p className="font-mono text-[11px] font-semibold text-zinc-100">
              {teamGame.resultLabel}
            </p>
          ) : teamGame.startTimeLabel ? (
            <p className="text-[10px] text-zinc-500">
              {teamGame.startTimeLabel}
            </p>
          ) : null}
        </div>
      ) : milestoneCount === 0 && specialCount > 0 ? (
        <div className="mt-auto">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400"
            title={`${specialCount} event${specialCount === 1 ? "" : "s"}`}
            aria-hidden
          />
          <p className="mt-0.5 text-[10px] text-zinc-500">
            {specialCount === 1 ? "Event" : `${specialCount} events`}
          </p>
        </div>
      ) : (
        <span className="mt-auto" />
      )}
    </button>
  );
}
