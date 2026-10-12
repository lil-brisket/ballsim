import { TeamBadge } from "@/components/ui/TeamBadge";
import { focusRingClass } from "@/components/ui/styles";
import type { TeamBrandingView } from "@/state/team-branding-view";
import type { CalendarDayCell as CalendarDayCellData } from "@/systems/calendar";

function dayNumber(isoDate: string): string {
  return String(Number(isoDate.slice(8, 10)));
}

export function calendarDayAriaLabel(
  cell: CalendarDayCellData,
  options?: { simulating?: boolean },
): string {
  const teamGame = cell.teamGame;
  const specialCount = cell.specialEvents.length;
  const simulatingToday = options?.simulating === true && cell.isToday;
  const parts = [
    cell.date,
    simulatingToday ? "simulating" : null,
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
  return parts.filter(Boolean).join(", ");
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

function resultTone(label: string | null): "win" | "loss" | null {
  if (label?.startsWith("W")) return "win";
  if (label?.startsWith("L")) return "loss";
  return null;
}

function dayCellStateClass(input: {
  cell: CalendarDayCellData;
  selected: boolean;
  simulating: boolean;
  hasContent: boolean;
}): string {
  const { cell, selected, simulating, hasContent } = input;
  const tone = resultTone(cell.teamGame?.resultLabel ?? null);
  const classes: string[] = [];

  if (!cell.inMonth) {
    classes.push("border-transparent bg-transparent");
  } else if (!hasContent) {
    // Empty days recede.
    classes.push("border-surface-line/40 bg-surface-deep/40");
  } else {
    classes.push("border-surface-line bg-surface-arena");
  }

  if (cell.teamGame) {
    classes.push(
      "border-l-4",
      tone === "win"
        ? "border-l-win"
        : tone === "loss"
          ? "border-l-loss"
          : "border-l-zinc-500",
    );
  }

  if (simulating && cell.isToday) {
    classes.push(
      "border-team-ink bg-team/30 ring-2 ring-team-ink ring-offset-2 ring-offset-surface-deep",
    );
  } else if (!simulating) {
    if (cell.isToday) {
      classes.push("border-team-ink bg-team/25 ring-2 ring-team-ink");
    }
    if (cell.isNextTeamGame && !cell.isToday) {
      classes.push("ring-2 ring-team-ink/80 team-pulse");
    }
    classes.push(selected ? "ring-2 ring-zinc-100" : "hover:border-zinc-500");
  }

  return classes.join(" ");
}

export function CalendarDayCell(props: {
  cell: CalendarDayCellData;
  selected: boolean;
  disabled?: boolean;
  simulating?: boolean;
  /** Opponent branding for the team game on this day, when known. */
  opponentBranding?: TeamBrandingView | null;
  onSelect: (date: string) => void;
}) {
  const { cell, selected, onSelect } = props;
  const disabled = props.disabled === true;
  const simulating = props.simulating === true;
  const simCursor = simulating && cell.isToday;
  const teamGame = cell.teamGame;
  const specialCount = cell.specialEvents.length;
  const milestoneCount = (cell.leagueMilestones ?? []).length;
  const hasContent = teamGame != null || specialCount > 0 || milestoneCount > 0;
  const tone = resultTone(teamGame?.resultLabel ?? null);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!disabled) onSelect(cell.date);
      }}
      aria-label={calendarDayAriaLabel(cell, { simulating })}
      aria-pressed={selected}
      data-sim-cursor={simCursor ? "true" : undefined}
      className={[
        "flex min-h-[5.5rem] flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors sm:min-h-[6.75rem] sm:p-2",
        focusRingClass,
        dayCellStateClass({ cell, selected, simulating, hasContent }),
        cell.isPast && !cell.isToday && !teamGame ? "opacity-70" : "",
        disabled ? "cursor-not-allowed" : "",
        disabled && !simulating ? "opacity-50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="flex items-start justify-between gap-1">
        <span
          className={[
            "font-display text-sm font-bold leading-none sm:text-base",
            !cell.inMonth
              ? "text-zinc-600"
              : cell.isToday
                ? "text-team-ink"
                : hasContent
                  ? "text-zinc-100"
                  : "text-zinc-500",
          ].join(" ")}
        >
          {dayNumber(cell.date)}
        </span>
        {cell.isNextTeamGame && !cell.isToday ? (
          <span className="rounded bg-team-ink px-1 font-mono text-[8px] font-bold uppercase leading-4 text-zinc-950 sm:text-[9px]">
            Next
          </span>
        ) : null}
      </span>

      <LeagueMilestoneChips milestones={cell.leagueMilestones ?? []} />

      {teamGame ? (
        <div className="mt-auto flex flex-col items-start gap-0.5">
          <span className="flex items-center gap-1">
            <TeamBadge
              branding={props.opponentBranding}
              name={teamGame.opponentName}
              size="sm"
              decorative
              className="!h-6 !w-6 sm:!h-8 sm:!w-8"
            />
            <span
              className="font-mono text-[9px] font-semibold uppercase text-zinc-400 sm:text-[10px]"
              title={teamGame.home ? "Home" : "Away"}
              aria-hidden
            >
              {teamGame.home ? "vs" : "@"}
            </span>
          </span>
          <p className="max-w-full truncate font-display text-xs font-bold uppercase leading-none tracking-wide text-zinc-50 sm:text-sm">
            {teamGame.opponentAbbreviation}
          </p>
          {teamGame.resultLabel ? (
            <p
              className={[
                "font-display text-[11px] font-extrabold leading-tight tabular-nums sm:whitespace-nowrap sm:text-sm",
                tone === "win"
                  ? "text-win"
                  : tone === "loss"
                    ? "text-loss"
                    : "text-zinc-100",
              ].join(" ")}
            >
              {teamGame.resultLabel}
            </p>
          ) : teamGame.startTimeLabel ? (
            <p className="text-[10px] text-zinc-400">
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
          <p className="mt-0.5 text-[10px] text-zinc-400">
            {specialCount === 1 ? "Event" : `${specialCount} events`}
          </p>
        </div>
      ) : (
        <span className="mt-auto" />
      )}
    </button>
  );
}
