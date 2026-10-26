import Link from "next/link";
import { Suspense } from "react";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import type { DashboardSnapshot } from "@/state/selectors";
import { formatShortDate } from "@/components/calendar/CalendarDayCell";
import { ParticipantBar } from "@/components/game/ParticipantBar";
import { HubBar } from "@/components/game/shell/HubBar";
import { OwnerTeamSwitcher } from "@/components/game/OwnerTeamSwitcher";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { buttonClass } from "@/components/ui/Button";
import { TickerBar, type TickerItem } from "@/components/ui/TickerBar";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";

function NotificationsBell(props: { saveId: string; unreadCount: number }) {
  const href = `/dashboard/${props.saveId}/notifications`;
  const label =
    props.unreadCount > 0
      ? `Notifications, ${props.unreadCount} unread`
      : "Notifications";

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        touchTargetClass,
        "relative shrink-0 rounded-lg border border-surface-line bg-surface-deep/60 text-soft hover:border-team-ink hover:text-team-ink",
        focusRingClass,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {props.unreadCount > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-team-ink px-1 text-xs font-semibold tabular-nums leading-4 text-surface-base">
          {props.unreadCount > 99 ? "99+" : props.unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Global in-save top bar, styled as a broadcast scoreboard: who am I managing
 * (team switcher), the hubs (desktop), date and record, notifications and the
 * one Sim action. Sim opens the calendar's next-game focus, which owns the
 * confirm and blocking rules. Sub-tabs render below it (SubTabBar).
 */
export function GameHeader(props: {
  saveId: string;
  saveName: string;
  dashboard: DashboardSnapshot;
  groups: readonly OwnerNavGroup[];
}) {
  const { dashboard, saveId } = props;
  const record = `${dashboard.controlledStanding.wins}–${dashboard.controlledStanding.losses}`;
  const tickerItems: TickerItem[] = [
    { label: "Date", value: formatShortDate(dashboard.currentDate) },
    { label: "Record", value: record, tone: "team" },
  ];

  return (
    <ArenaPanel
      as="header"
      edge="top"
      density="compact"
      className="flex flex-col gap-2 lg:px-4 lg:py-2"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/home"
          className={cn(
            // Not touchTargetTextClass: its inline-flex would beat `hidden`.
            "-my-2 -ml-2 hidden min-h-11 items-center px-2 font-display text-base font-bold uppercase tracking-wider text-muted touch-manipulation hover:text-team-ink xl:inline-flex",
            focusRingClass,
          )}
        >
          BallSim
        </Link>
        <div className="min-w-0 flex-1 lg:max-w-xs lg:flex-none">
          <Suspense fallback={null}>
            <OwnerTeamSwitcher
              saveId={saveId}
              ownedTeams={dashboard.ownedTeams}
              activeParticipantId={dashboard.participation?.activeParticipantId}
            />
          </Suspense>
        </div>
        <div className="hidden min-w-0 flex-1 justify-center lg:flex">
          <HubBar saveId={saveId} groups={props.groups} />
        </div>
        <TickerBar
          aria-label="Season status"
          items={tickerItems}
          className="hidden xl:flex"
        />
        <p className="shrink-0 font-display text-xl font-bold tabular-nums text-team-ink xl:hidden">
          <span className="sr-only">Record </span>
          {record}
        </p>
        <NotificationsBell
          saveId={saveId}
          unreadCount={dashboard.unreadNotificationCount}
        />
        <Link
          href={`/dashboard/${saveId}/calendar?focus=next-game`}
          aria-label="Sim to next game"
          className={cn(
            buttonClass({ variant: "primary" }),
            "shrink-0 px-5 font-display text-lg uppercase tracking-wide",
          )}
        >
          Sim
        </Link>
      </div>

      <Suspense fallback={null}>
        <ParticipantBar
          saveId={saveId}
          participation={dashboard.participation}
        />
      </Suspense>
    </ArenaPanel>
  );
}
