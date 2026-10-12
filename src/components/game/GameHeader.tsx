import Link from "next/link";
import { Suspense } from "react";
import { getGameModeDefinition } from "@/application/game-mode-catalog";
import type { DashboardSnapshot } from "@/state/selectors";
import { formatShortDate } from "@/components/calendar/CalendarDayCell";
import { OwnerTeamSwitcher } from "@/components/game/OwnerTeamSwitcher";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { TickerBar, type TickerItem } from "@/components/ui/TickerBar";
import {
  cn,
  focusRingClass,
  touchTargetClass,
  touchTargetTextClass,
} from "@/components/ui/styles";

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
        "relative shrink-0 rounded-lg border border-surface-line bg-surface-deep/60 text-zinc-300 hover:border-team-ink hover:text-team-ink",
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
        <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-team-ink px-1 font-mono text-[0.65rem] font-semibold leading-4 text-zinc-950">
          {props.unreadCount > 99 ? "99+" : props.unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Global in-save header, styled as a broadcast scoreboard bar: who am I
 * managing (team switcher), and a ticker with date, record and rank.
 * Unread notifications live on the bell. Financial snapshot lives on
 * Dashboard / Finances — not here.
 */
export function GameHeader(props: {
  saveId: string;
  saveName: string;
  dashboard: DashboardSnapshot;
  menu?: React.ReactNode;
}) {
  const { dashboard, saveId } = props;
  const modeDef = getGameModeDefinition(dashboard.mode);
  const record = `${dashboard.controlledStanding.wins}–${dashboard.controlledStanding.losses}`;
  const tickerItems: TickerItem[] = [
    { label: "Date", value: formatShortDate(dashboard.currentDate) },
    { label: "Season", value: dashboard.seasonYear },
    { label: "Record", value: record, tone: "team" },
    {
      label: "Rank",
      value:
        dashboard.standingsRank == null ? "—" : `#${dashboard.standingsRank}`,
    },
  ];

  return (
    <ArenaPanel
      as="header"
      edge="top"
      density="compact"
      className="flex flex-col gap-2 sm:p-4"
    >
      <div className="hidden items-center gap-2 sm:flex">
        <Link
          href="/home"
          className={cn(
            touchTargetTextClass,
            "-my-2 -ml-2 font-display text-base font-bold uppercase tracking-wider text-zinc-100 hover:text-team-ink",
            focusRingClass,
          )}
        >
          BallSim
        </Link>
        <span className="text-zinc-700" aria-hidden>
          /
        </span>
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-team-ink">
          {modeDef.name}
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        {props.menu}
        <div className="min-w-0 flex-1">
          <Suspense fallback={null}>
            <OwnerTeamSwitcher
              saveId={saveId}
              ownedTeams={dashboard.ownedTeams}
            />
          </Suspense>
        </div>
        <TickerBar
          aria-label="Season status"
          items={tickerItems}
          className="hidden md:flex"
        />
        <NotificationsBell
          saveId={saveId}
          unreadCount={dashboard.unreadNotificationCount}
        />
      </div>

      <TickerBar
        aria-label="Season status"
        items={tickerItems}
        className="border-t border-surface-line pt-2 md:hidden"
      />
    </ArenaPanel>
  );
}
