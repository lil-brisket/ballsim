import Link from "next/link";
import type { CalendarEventView } from "@/domain/entities/calendar-event";
import type { TeamId } from "@/domain/ids";
import { parseCalendarDate } from "@/domain/calendar-date";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { StatusBadge } from "@/components/owner/StatusBadge";
import {
  ATTENTION_TIER_LABEL,
  groupEventsByAttentionTier,
} from "@/components/calendar/event-attention-tiers";
import { cn, focusRingClass } from "@/components/ui/styles";

function formatLongDate(isoDate: string): string {
  try {
    const { year, month, day } = parseCalendarDate(isoDate);
    const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return utc.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return isoDate;
  }
}

function lifecycleBadge(lifecycle: CalendarEventView["lifecycle"]): {
  label: string;
  tone: string;
} | null {
  switch (lifecycle) {
    case "scheduled":
      return { label: "Scheduled", tone: "info" };
    case "occurred":
      return { label: "Occurred", tone: "completed" };
    case "action_required":
      return { label: "Action Required", tone: "warning" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    default:
      return null;
  }
}

export function CalendarDayDetail(props: {
  saveId: string;
  date: string;
  events: readonly CalendarEventView[];
  currentDate: string;
  userTeamId?: TeamId | null;
  onClose?: () => void;
  teamGame?: {
    gameId: string;
    opponentLabel: string;
    opponentTeamId?: string;
    home: boolean;
    status: string;
    scoreLabel: string | null;
  } | null;
  simulatePanel?: React.ReactNode;
}) {
  const isFuture = props.date > props.currentDate;
  const isToday = props.date === props.currentDate;
  const tiers = groupEventsByAttentionTier(props.events, props.userTeamId);

  return (
    <aside className="flex h-full flex-col rounded-lg border border-zinc-800 bg-zinc-950/50">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div>
          <h3 className="text-base font-medium text-zinc-100">
            {formatLongDate(props.date)}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">
            {props.date}
            {isToday ? (
              <span className="ml-2 text-xs uppercase tracking-wide text-amber-300">
                today
              </span>
            ) : null}
            {isFuture ? (
              <span className="ml-2 text-xs uppercase tracking-wide text-zinc-500">
                upcoming
              </span>
            ) : null}
          </p>
        </div>
        {props.onClose ? (
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500 lg:hidden"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <section className="space-y-2 rounded-md border border-sky-900/40 bg-sky-950/20 px-3 py-3">
          <h4 className="text-xs uppercase tracking-wide text-sky-400/90">
            Your team
          </h4>
          {props.teamGame ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-100">
                {props.teamGame.home ? "vs" : "@"}{" "}
                {props.teamGame.opponentTeamId ? (
                  <TeamEntityLink
                    saveId={props.saveId}
                    teamId={props.teamGame.opponentTeamId}
                    className="text-zinc-100 hover:text-amber-400"
                  >
                    {props.teamGame.opponentLabel}
                  </TeamEntityLink>
                ) : (
                  props.teamGame.opponentLabel
                )}
              </p>
              <p className="text-xs text-zinc-400">
                {props.teamGame.status}
                {props.teamGame.scoreLabel
                  ? ` · ${props.teamGame.scoreLabel}`
                  : ""}
              </p>
              <Link
                href={`/dashboard/${props.saveId}/games/${props.teamGame.gameId}`}
                className={cn(
                  "inline-block text-xs text-amber-400 hover:text-amber-300",
                  focusRingClass,
                )}
              >
                View game
              </Link>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No game</p>
          )}
        </section>

        {tiers.length === 0 ? (
          <p className="text-sm text-zinc-500">No events on this date.</p>
        ) : (
          tiers.map((group) => (
            <section key={group.tier} className="space-y-2">
              <h4
                className={cn(
                  "text-xs uppercase tracking-wide",
                  group.tier === 1
                    ? "text-sky-400"
                    : group.tier === 2
                      ? "text-amber-400"
                      : group.tier === 3
                        ? "text-zinc-400"
                        : "text-zinc-600",
                )}
              >
                {ATTENTION_TIER_LABEL[group.tier]}
              </h4>
              <ul className="space-y-2">
                {group.events.map((event) => {
                  const badge = lifecycleBadge(event.lifecycle);
                  const playerId = event.playerIds?.[0];
                  const teamId = event.teamIds?.[0];
                  const body = (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "text-sm",
                            group.tier <= 2 ? "text-zinc-100" : "text-zinc-300",
                          )}
                        >
                          {event.title}
                        </span>
                        {badge ? (
                          <StatusBadge label={badge.label} tone={badge.tone} />
                        ) : null}
                        {event.blocking ? (
                          <StatusBadge label="Blocking" tone="critical" />
                        ) : null}
                      </div>
                      {event.description ? (
                        <p className="text-xs text-zinc-400">
                          {event.description}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {playerId ? (
                          <PlayerEntityLink
                            saveId={props.saveId}
                            playerId={playerId}
                            className="text-amber-400 hover:text-amber-300"
                          >
                            Player
                          </PlayerEntityLink>
                        ) : null}
                        {teamId && !playerId ? (
                          <TeamEntityLink
                            saveId={props.saveId}
                            teamId={teamId}
                            className="text-amber-400 hover:text-amber-300"
                          >
                            Team
                          </TeamEntityLink>
                        ) : null}
                      </div>
                    </div>
                  );
                  return (
                    <li
                      key={event.id}
                      className={cn(
                        "rounded-md border px-3 py-2",
                        group.tier === 1
                          ? "border-sky-800/50 bg-sky-950/20"
                          : group.tier === 2
                            ? "border-amber-800/40 bg-amber-950/15"
                            : "border-zinc-800/80 bg-zinc-900/40",
                      )}
                    >
                      {event.href ? (
                        <Link href={event.href} className="block">
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}

        {isFuture ? (
          <p className="text-xs text-zinc-600">
            Future dates show scheduled and action-required items only.
          </p>
        ) : null}

        {props.simulatePanel ? (
          <div className="border-t border-zinc-800 pt-3">{props.simulatePanel}</div>
        ) : null}
      </div>
    </aside>
  );
}
